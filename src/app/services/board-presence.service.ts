import { Injectable, signal, inject, effect, OnDestroy } from '@angular/core';
import {
  doc,
  collection,
  setDoc,
  deleteDoc,
  onSnapshot,
  Unsubscribe,
  serverTimestamp,
} from 'firebase/firestore';
import { AuthService } from './auth.service';
import { BoardService } from './board.service';
import { db } from '../firebase.config';
import { UserPresence, getPresenceColor } from '../models/investigation-board.model';

const PRESENCE_UPDATE_INTERVAL = 100; // Debounce cursor updates (ms)
const PRESENCE_CLEANUP_INTERVAL = 30000; // Clean stale presence every 30s
const PRESENCE_TIMEOUT = 60000; // Consider offline after 60s

@Injectable({ providedIn: 'root' })
export class BoardPresenceService implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly boardService = inject(BoardService);

  private readonly _otherUsers = signal<Map<string, UserPresence>>(new Map());
  private readonly _isTracking = signal(false);

  private presenceUnsub: Unsubscribe | null = null;
  private cursorUpdateTimeout: ReturnType<typeof setTimeout> | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  private currentBoardId: string | null = null;
  private pendingCursorPosition: { x: number; y: number } | null = null;

  readonly otherUsers = this._otherUsers.asReadonly();
  readonly isTracking = this._isTracking.asReadonly();

  constructor() {
    // Auto-start tracking when board is loaded
    effect(() => {
      const metadata = this.boardService.boardMetadata();
      const user = this.auth.user();

      if (metadata && user) {
        if (this.currentBoardId !== metadata.id) {
          this.startTracking(metadata.id);
        }
      } else {
        this.stopTracking();
      }
    });
  }

  ngOnDestroy(): void {
    this.stopTracking();
  }

  private getPresencePath(boardId: string): string {
    return `boards/${boardId}/presence`;
  }

  private getMyPresenceDoc(boardId: string): string {
    const user = this.auth.user();
    if (!user) throw new Error('User not authenticated');
    return `boards/${boardId}/presence/${user.uid}`;
  }

  async startTracking(boardId: string): Promise<void> {
    const user = this.auth.user();
    if (!user) return;

    // Stop previous tracking if any
    await this.stopTracking();

    this.currentBoardId = boardId;
    this._isTracking.set(true);

    // Set initial presence
    await this.updatePresence({
      odId: user.uid,
      odName: user.displayName || 'Anonymous',
      odPhotoURL: user.photoURL || undefined,
      color: getPresenceColor(user.uid),
      isOnline: true,
    });

    // Subscribe to other users' presence
    this.subscribeToPresence(boardId);

    // Start heartbeat to keep presence alive
    this.startHeartbeat();

    // Start cleanup of stale presence
    this.startCleanupInterval();
  }

  async stopTracking(): Promise<void> {
    if (!this.currentBoardId) return;

    // Clear intervals
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    if (this.cursorUpdateTimeout) {
      clearTimeout(this.cursorUpdateTimeout);
      this.cursorUpdateTimeout = null;
    }

    // Unsubscribe from presence updates
    if (this.presenceUnsub) {
      this.presenceUnsub();
      this.presenceUnsub = null;
    }

    // Remove my presence
    try {
      const user = this.auth.user();
      if (user && this.currentBoardId) {
        const presenceRef = doc(db, this.getMyPresenceDoc(this.currentBoardId));
        await deleteDoc(presenceRef);
      }
    } catch (error) {
      console.error('[PresenceService] Failed to remove presence:', error);
    }

    this.currentBoardId = null;
    this._otherUsers.set(new Map());
    this._isTracking.set(false);
  }

  private subscribeToPresence(boardId: string): void {
    const user = this.auth.user();
    if (!user) return;

    const presenceRef = collection(db, this.getPresencePath(boardId));
    this.presenceUnsub = onSnapshot(
      presenceRef,
      (snapshot) => {
        const users = new Map<string, UserPresence>();
        snapshot.forEach((doc) => {
          const data = doc.data() as UserPresence;
          // Don't include self in other users
          if (doc.id !== user.uid && data.isOnline) {
            users.set(doc.id, { ...data, odId: doc.id });
          }
        });
        this._otherUsers.set(users);
      },
      (error) => {
        console.error('[PresenceService] Presence sync error:', error);
      }
    );
  }

  private async updatePresence(data: Partial<UserPresence>): Promise<void> {
    const user = this.auth.user();
    if (!user || !this.currentBoardId) return;

    try {
      const presenceRef = doc(db, this.getMyPresenceDoc(this.currentBoardId));
      await setDoc(
        presenceRef,
        {
          ...data,
          lastSeen: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      console.error('[PresenceService] Failed to update presence:', error);
    }
  }

  private startHeartbeat(): void {
    // Update lastSeen periodically to indicate we're still online
    this.heartbeatInterval = setInterval(() => {
      this.updatePresence({ isOnline: true });
    }, PRESENCE_CLEANUP_INTERVAL / 2);
  }

  private startCleanupInterval(): void {
    // Periodically check for stale presence entries
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const users = this._otherUsers();
      const activeUsers = new Map<string, UserPresence>();

      users.forEach((user, odId) => {
        const lastSeen = user.lastSeen?.toMillis?.() || 0;
        if (now - lastSeen < PRESENCE_TIMEOUT) {
          activeUsers.set(odId, user);
        }
      });

      if (activeUsers.size !== users.size) {
        this._otherUsers.set(activeUsers);
      }
    }, PRESENCE_CLEANUP_INTERVAL);
  }

  // ===== Public Methods =====

  updateCursorPosition(x: number, y: number): void {
    if (!this._isTracking()) return;

    this.pendingCursorPosition = { x, y };

    // Debounce cursor updates
    if (this.cursorUpdateTimeout) {
      clearTimeout(this.cursorUpdateTimeout);
    }

    this.cursorUpdateTimeout = setTimeout(() => {
      if (this.pendingCursorPosition) {
        this.updatePresence({
          cursorPosition: this.pendingCursorPosition,
        });
        this.pendingCursorPosition = null;
      }
    }, PRESENCE_UPDATE_INTERVAL);
  }

  updateSelectedCard(cardId: string | null): void {
    if (!this._isTracking()) return;

    this.updatePresence({
      selectedCardId: cardId || undefined,
    });
  }

  updateEditingCard(cardId: string | null): void {
    if (!this._isTracking()) return;

    this.updatePresence({
      editingCardId: cardId || undefined,
    });
  }

  // Get users who are editing a specific card
  getUsersEditingCard(cardId: string): UserPresence[] {
    const users: UserPresence[] = [];
    this._otherUsers().forEach((user) => {
      if (user.editingCardId === cardId) {
        users.push(user);
      }
    });
    return users;
  }

  // Get user who has selected a specific card
  getUsersSelectingCard(cardId: string): UserPresence[] {
    const users: UserPresence[] = [];
    this._otherUsers().forEach((user) => {
      if (user.selectedCardId === cardId) {
        users.push(user);
      }
    });
    return users;
  }
}
