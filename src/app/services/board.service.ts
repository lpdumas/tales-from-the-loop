import { Injectable, signal, inject, effect } from '@angular/core';
import {
  doc,
  collection,
  setDoc,
  getDoc,
  deleteDoc,
  onSnapshot,
  Unsubscribe,
  serverTimestamp,
  query,
  where,
  getDocs,
  writeBatch,
  updateDoc,
} from 'firebase/firestore';
import { AuthService } from './auth.service';
import { db } from '../firebase.config';
import {
  InvestigationCard,
  CardLink,
  BoardMetadata,
  BoardMember,
  BoardRole,
  generateId,
  generateShareCode,
  createDefaultCard,
  createDefaultLink,
  createDefaultBoard,
} from '../models/investigation-board.model';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

@Injectable({ providedIn: 'root' })
export class BoardService {
  private readonly auth = inject(AuthService);

  private readonly _syncStatus = signal<SyncStatus>('idle');
  private readonly _cards = signal<Map<string, InvestigationCard>>(new Map());
  private readonly _links = signal<Map<string, CardLink>>(new Map());
  private readonly _boardMetadata = signal<BoardMetadata | null>(null);
  private readonly _userBoards = signal<BoardMetadata[]>([]);

  private boardUnsub: Unsubscribe | null = null;
  private cardsUnsub: Unsubscribe | null = null;
  private linksUnsub: Unsubscribe | null = null;
  private userBoardsUnsub: Unsubscribe | null = null;
  private pendingSaves = new Map<string, ReturnType<typeof setTimeout>>();

  readonly syncStatus = this._syncStatus.asReadonly();
  readonly cards = this._cards.asReadonly();
  readonly links = this._links.asReadonly();
  readonly boardMetadata = this._boardMetadata.asReadonly();
  readonly userBoards = this._userBoards.asReadonly();

  private currentBoardId: string | null = null;

  constructor() {
    effect(() => {
      const user = this.auth.user();
      if (user) {
        this.subscribeToUserBoards();
      } else {
        this.unsubscribeAll();
        this._syncStatus.set('offline');
        this._cards.set(new Map());
        this._links.set(new Map());
        this._boardMetadata.set(null);
        this._userBoards.set([]);
      }
    });
  }

  // Paths are now at root level for shared access
  private getBoardPath(boardId: string): string {
    return `boards/${boardId}`;
  }

  private getCardsPath(boardId: string): string {
    return `boards/${boardId}/cards`;
  }

  private getLinksPath(boardId: string): string {
    return `boards/${boardId}/links`;
  }

  private getPresencePath(boardId: string): string {
    return `boards/${boardId}/presence`;
  }

  private subscribeToUserBoards(): void {
    const user = this.auth.user();
    if (!user) return;

    if (this.userBoardsUnsub) {
      this.userBoardsUnsub();
    }

    // Query boards where user is a member
    const boardsRef = collection(db, 'boards');
    const q = query(boardsRef, where(`members.${user.uid}.odId`, '==', user.uid));

    this.userBoardsUnsub = onSnapshot(
      q,
      (snapshot) => {
        const boards: BoardMetadata[] = [];
        snapshot.forEach((doc) => {
          boards.push({ ...doc.data(), id: doc.id } as BoardMetadata);
        });
        this._userBoards.set(boards);

        // Auto-load first board or create default
        if (boards.length > 0 && !this.currentBoardId) {
          this.loadBoard(boards[0].id);
        } else if (boards.length === 0 && !this.currentBoardId) {
          this.createBoard('Investigation Board');
        }
      },
      (error) => {
        console.error('[BoardService] User boards sync error:', error);
      }
    );
  }

  async loadBoard(boardId: string): Promise<void> {
    const user = this.auth.user();
    if (!user) {
      this._syncStatus.set('offline');
      return;
    }

    // Unsubscribe from previous board (but keep userBoards subscription)
    this.unsubscribeFromBoard();
    this.currentBoardId = boardId;
    this._syncStatus.set('syncing');

    try {
      this.subscribeToBoardMetadata(boardId);
      this.subscribeToCards(boardId);
      this.subscribeToLinks(boardId);
    } catch (error) {
      console.error('[BoardService] Failed to load board:', error);
      this._syncStatus.set('error');
    }
  }

  async createBoard(name: string): Promise<string | null> {
    const user = this.auth.user();
    if (!user) return null;

    const boardId = generateId();
    const boardData = createDefaultBoard(
      user.uid,
      user.displayName || 'Anonymous',
      user.email || ''
    );

    const boardRef = doc(db, this.getBoardPath(boardId));
    this._syncStatus.set('syncing');

    try {
      await setDoc(boardRef, {
        ...boardData,
        id: boardId,
        members: {
          [user.uid]: {
            ...boardData.members[user.uid],
            joinedAt: serverTimestamp(),
          },
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await this.loadBoard(boardId);
      return boardId;
    } catch (error) {
      console.error('[BoardService] Failed to create board:', error);
      this._syncStatus.set('error');
      return null;
    }
  }

  private subscribeToBoardMetadata(boardId: string): void {
    const boardRef = doc(db, this.getBoardPath(boardId));
    this.boardUnsub = onSnapshot(
      boardRef,
      (snapshot) => {
        if (snapshot.exists()) {
          this._boardMetadata.set({ ...snapshot.data(), id: snapshot.id } as BoardMetadata);
        }
      },
      (error) => {
        console.error('[BoardService] Board metadata sync error:', error);
      }
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

  private unsubscribeFromBoard(): void {
    if (this.boardUnsub) {
      this.boardUnsub();
      this.boardUnsub = null;
    }
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

  private unsubscribeAll(): void {
    this.unsubscribeFromBoard();
    if (this.userBoardsUnsub) {
      this.userBoardsUnsub();
      this.userBoardsUnsub = null;
    }
  }

  // ===== Sharing Methods =====

  async generateShareLink(): Promise<string | null> {
    if (!this.currentBoardId) return null;

    const shareCode = generateShareCode();
    const boardRef = doc(db, this.getBoardPath(this.currentBoardId));

    try {
      await updateDoc(boardRef, {
        shareCode,
        updatedAt: serverTimestamp(),
      });
      return shareCode;
    } catch (error) {
      console.error('[BoardService] Failed to generate share link:', error);
      return null;
    }
  }

  async joinBoardByCode(shareCode: string): Promise<string | null> {
    const user = this.auth.user();
    if (!user) return null;

    try {
      // Find board with this share code
      const boardsRef = collection(db, 'boards');
      const q = query(boardsRef, where('shareCode', '==', shareCode));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        console.error('[BoardService] No board found with share code:', shareCode);
        return null;
      }

      const boardDoc = snapshot.docs[0];
      const boardId = boardDoc.id;
      const boardData = boardDoc.data() as BoardMetadata;

      // Check if already a member
      if (boardData.members[user.uid]) {
        await this.loadBoard(boardId);
        return boardId;
      }

      // Add user as editor
      const boardRef = doc(db, this.getBoardPath(boardId));
      await updateDoc(boardRef, {
        [`members.${user.uid}`]: {
          odId: user.uid,
          odName: user.displayName || 'Anonymous',
          odEmail: user.email || '',
          odPhotoURL: user.photoURL || null,
          role: 'editor' as BoardRole,
          joinedAt: serverTimestamp(),
        },
        updatedAt: serverTimestamp(),
      });

      await this.loadBoard(boardId);
      return boardId;
    } catch (error) {
      console.error('[BoardService] Failed to join board:', error);
      return null;
    }
  }

  async updateMemberRole(memberId: string, role: BoardRole): Promise<void> {
    if (!this.currentBoardId) return;

    const boardRef = doc(db, this.getBoardPath(this.currentBoardId));

    try {
      await updateDoc(boardRef, {
        [`members.${memberId}.role`]: role,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('[BoardService] Failed to update member role:', error);
    }
  }

  async removeMember(memberId: string): Promise<void> {
    if (!this.currentBoardId) return;

    const board = this._boardMetadata();
    if (!board || board.ownerId === memberId) {
      console.error('[BoardService] Cannot remove board owner');
      return;
    }

    const boardRef = doc(db, this.getBoardPath(this.currentBoardId));
    const { [memberId]: removed, ...remainingMembers } = board.members;

    try {
      await updateDoc(boardRef, {
        members: remainingMembers,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('[BoardService] Failed to remove member:', error);
    }
  }

  async updateBoardName(name: string): Promise<void> {
    if (!this.currentBoardId) return;

    const boardRef = doc(db, this.getBoardPath(this.currentBoardId));

    try {
      await updateDoc(boardRef, {
        name,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('[BoardService] Failed to update board name:', error);
    }
  }

  // ===== Card Methods =====

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

  // ===== Link Methods =====

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

  // ===== Getters =====

  getCurrentBoardId(): string | null {
    return this.currentBoardId;
  }

  getPresenceCollectionPath(): string | null {
    if (!this.currentBoardId) return null;
    return this.getPresencePath(this.currentBoardId);
  }
}
