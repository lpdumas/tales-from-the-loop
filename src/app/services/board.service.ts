import { Injectable, signal, inject, effect } from '@angular/core';
import {
  doc,
  collection,
  setDoc,
  deleteDoc,
  onSnapshot,
  Unsubscribe,
  serverTimestamp,
  query,
  where,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { AuthService } from './auth.service';
import { db } from '../firebase.config';
import {
  InvestigationCard,
  CardLink,
  BoardMetadata,
  generateId,
  createDefaultCard,
  createDefaultLink,
  createDefaultBoard,
} from '../models/investigation-board.model';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

const DEFAULT_BOARD_ID = 'default';

@Injectable({ providedIn: 'root' })
export class BoardService {
  private readonly auth = inject(AuthService);

  private readonly _syncStatus = signal<SyncStatus>('idle');
  private readonly _cards = signal<Map<string, InvestigationCard>>(new Map());
  private readonly _links = signal<Map<string, CardLink>>(new Map());
  private readonly _boardMetadata = signal<BoardMetadata | null>(null);

  private cardsUnsub: Unsubscribe | null = null;
  private linksUnsub: Unsubscribe | null = null;
  private pendingSaves = new Map<string, ReturnType<typeof setTimeout>>();

  readonly syncStatus = this._syncStatus.asReadonly();
  readonly cards = this._cards.asReadonly();
  readonly links = this._links.asReadonly();
  readonly boardMetadata = this._boardMetadata.asReadonly();

  private currentBoardId: string | null = null;

  constructor() {
    effect(() => {
      const user = this.auth.user();
      if (user) {
        this.loadBoard(DEFAULT_BOARD_ID);
      } else {
        this.unsubscribeAll();
        this._syncStatus.set('offline');
        this._cards.set(new Map());
        this._links.set(new Map());
        this._boardMetadata.set(null);
      }
    });
  }

  private getBoardPath(boardId: string): string {
    const user = this.auth.user();
    if (!user) throw new Error('User not authenticated');
    return `users/${user.uid}/boards/${boardId}`;
  }

  private getCardsPath(boardId: string): string {
    return `${this.getBoardPath(boardId)}/cards`;
  }

  private getLinksPath(boardId: string): string {
    return `${this.getBoardPath(boardId)}/links`;
  }

  async loadBoard(boardId: string): Promise<void> {
    const user = this.auth.user();
    if (!user) {
      this._syncStatus.set('offline');
      return;
    }

    this.unsubscribeAll();
    this.currentBoardId = boardId;
    this._syncStatus.set('syncing');

    try {
      await this.ensureBoardExists(boardId);
      this.subscribeToCards(boardId);
      this.subscribeToLinks(boardId);
    } catch (error) {
      console.error('[BoardService] Failed to load board:', error);
      this._syncStatus.set('error');
    }
  }

  private async ensureBoardExists(boardId: string): Promise<void> {
    const user = this.auth.user();
    if (!user) return;

    const boardRef = doc(db, this.getBoardPath(boardId));
    const boardData = createDefaultBoard(user.uid);

    await setDoc(
      boardRef,
      {
        ...boardData,
        id: boardId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  private subscribeToCards(boardId: string): void {
    const cardsRef = collection(db, this.getCardsPath(boardId));
    this.cardsUnsub = onSnapshot(
      cardsRef,
      (snapshot) => {
        const cards = new Map<string, InvestigationCard>();
        snapshot.forEach((doc) => {
          const data = doc.data() as InvestigationCard;
          cards.set(doc.id, { ...data, id: doc.id });
        });
        this._cards.set(cards);
        this._syncStatus.set('synced');
      },
      (error) => {
        console.error('[BoardService] Cards sync error:', error);
        this._syncStatus.set('error');
      }
    );
  }

  private subscribeToLinks(boardId: string): void {
    const linksRef = collection(db, this.getLinksPath(boardId));
    this.linksUnsub = onSnapshot(
      linksRef,
      (snapshot) => {
        const links = new Map<string, CardLink>();
        snapshot.forEach((doc) => {
          const data = doc.data() as CardLink;
          links.set(doc.id, { ...data, id: doc.id });
        });
        this._links.set(links);
      },
      (error) => {
        console.error('[BoardService] Links sync error:', error);
      }
    );
  }

  private unsubscribeAll(): void {
    if (this.cardsUnsub) {
      this.cardsUnsub();
      this.cardsUnsub = null;
    }
    if (this.linksUnsub) {
      this.linksUnsub();
      this.linksUnsub = null;
    }
    this.pendingSaves.forEach((timeout) => clearTimeout(timeout));
    this.pendingSaves.clear();
    this.currentBoardId = null;
  }

  async addCard(position: { x: number; y: number }): Promise<string | null> {
    const user = this.auth.user();
    if (!user || !this.currentBoardId) {
      console.error('[BoardService] Cannot add card: not authenticated or no board');
      return null;
    }

    const cardId = generateId();
    const cardData = createDefaultCard(this.currentBoardId, user.uid, position);

    const cardRef = doc(db, this.getCardsPath(this.currentBoardId), cardId);
    this._syncStatus.set('syncing');

    try {
      await setDoc(cardRef, {
        ...cardData,
        id: cardId,
        meta: {
          ...cardData.meta,
          updatedAt: serverTimestamp(),
          fieldVersions: {},
        },
      });
      return cardId;
    } catch (error) {
      console.error('[BoardService] Failed to add card:', error);
      this._syncStatus.set('error');
      return null;
    }
  }

  updateCard(cardId: string, updates: Partial<InvestigationCard>): void {
    const user = this.auth.user();
    if (!user || !this.currentBoardId) return;

    // Optimistic update
    const currentCards = this._cards();
    const existingCard = currentCards.get(cardId);
    if (existingCard) {
      const updatedCard = { ...existingCard, ...updates };
      const newCards = new Map(currentCards);
      newCards.set(cardId, updatedCard);
      this._cards.set(newCards);
    }

    // Debounced Firestore save (800ms service-level debounce)
    const pendingKey = `card:${cardId}`;
    if (this.pendingSaves.has(pendingKey)) {
      clearTimeout(this.pendingSaves.get(pendingKey)!);
    }

    this._syncStatus.set('syncing');
    this.pendingSaves.set(
      pendingKey,
      setTimeout(async () => {
        this.pendingSaves.delete(pendingKey);
        try {
          const cardRef = doc(db, this.getCardsPath(this.currentBoardId!), cardId);
          await setDoc(
            cardRef,
            {
              ...updates,
              meta: {
                updatedBy: user.uid,
                updatedAt: serverTimestamp(),
              },
            },
            { merge: true }
          );
          this._syncStatus.set('synced');
        } catch (error) {
          console.error('[BoardService] Failed to update card:', error);
          this._syncStatus.set('error');
        }
      }, 800)
    );
  }

  async deleteCard(cardId: string): Promise<void> {
    if (!this.currentBoardId) return;

    // Cancel pending save for this card
    const pendingKey = `card:${cardId}`;
    if (this.pendingSaves.has(pendingKey)) {
      clearTimeout(this.pendingSaves.get(pendingKey)!);
      this.pendingSaves.delete(pendingKey);
    }

    this._syncStatus.set('syncing');

    try {
      // Delete the card
      const cardRef = doc(db, this.getCardsPath(this.currentBoardId), cardId);
      await deleteDoc(cardRef);

      // Delete all links connected to this card
      const linksRef = collection(db, this.getLinksPath(this.currentBoardId));
      const sourceQuery = query(linksRef, where('sourceCardId', '==', cardId));
      const targetQuery = query(linksRef, where('targetCardId', '==', cardId));

      const [sourceSnapshot, targetSnapshot] = await Promise.all([
        getDocs(sourceQuery),
        getDocs(targetQuery),
      ]);

      const batch = writeBatch(db);
      sourceSnapshot.forEach((doc) => batch.delete(doc.ref));
      targetSnapshot.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();

      this._syncStatus.set('synced');
    } catch (error) {
      console.error('[BoardService] Failed to delete card:', error);
      this._syncStatus.set('error');
    }
  }

  async addLink(sourceCardId: string, targetCardId: string): Promise<string | null> {
    if (!this.currentBoardId) return null;

    // Check if link already exists
    const existingLinks = this._links();
    for (const link of existingLinks.values()) {
      if (
        (link.sourceCardId === sourceCardId && link.targetCardId === targetCardId) ||
        (link.sourceCardId === targetCardId && link.targetCardId === sourceCardId)
      ) {
        return null; // Link already exists
      }
    }

    const linkId = generateId();
    const linkData = createDefaultLink(this.currentBoardId, sourceCardId, targetCardId);

    const linkRef = doc(db, this.getLinksPath(this.currentBoardId), linkId);
    this._syncStatus.set('syncing');

    try {
      await setDoc(linkRef, {
        ...linkData,
        id: linkId,
      });
      return linkId;
    } catch (error) {
      console.error('[BoardService] Failed to add link:', error);
      this._syncStatus.set('error');
      return null;
    }
  }

  async updateLink(linkId: string, updates: Partial<CardLink>): Promise<void> {
    if (!this.currentBoardId) return;

    const linkRef = doc(db, this.getLinksPath(this.currentBoardId), linkId);
    this._syncStatus.set('syncing');

    try {
      await setDoc(linkRef, updates, { merge: true });
      this._syncStatus.set('synced');
    } catch (error) {
      console.error('[BoardService] Failed to update link:', error);
      this._syncStatus.set('error');
    }
  }

  async deleteLink(linkId: string): Promise<void> {
    if (!this.currentBoardId) return;

    const linkRef = doc(db, this.getLinksPath(this.currentBoardId), linkId);
    this._syncStatus.set('syncing');

    try {
      await deleteDoc(linkRef);
      this._syncStatus.set('synced');
    } catch (error) {
      console.error('[BoardService] Failed to delete link:', error);
      this._syncStatus.set('error');
    }
  }
}
