import { Injectable, signal, inject, effect } from '@angular/core';
import { doc, setDoc, getDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { Character, createDefaultCharacter } from '../models/character.model';
import { AuthService } from './auth.service';
import { db } from '../firebase.config';

const STORAGE_KEY = 'tftl_character';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly auth = inject(AuthService);
  private readonly _syncStatus = signal<SyncStatus>('idle');
  private firestoreUnsub: Unsubscribe | null = null;
  private pendingSave: ReturnType<typeof setTimeout> | null = null;

  readonly syncStatus = this._syncStatus.asReadonly();

  constructor() {
    effect(() => {
      const user = this.auth.user();
      if (user) {
        this.subscribeToFirestore(user.uid);
      } else {
        this.unsubscribeFromFirestore();
        this._syncStatus.set('offline');
      }
    });
  }

  private subscribeToFirestore(uid: string): void {
    this.unsubscribeFromFirestore();
    const docRef = doc(db, 'characters', uid);
    this.firestoreUnsub = onSnapshot(
      docRef,
      () => {
        this._syncStatus.set('synced');
      },
      (error) => {
        console.error('Firestore sync error:', error);
        this._syncStatus.set('error');
      },
    );
  }

  private unsubscribeFromFirestore(): void {
    if (this.firestoreUnsub) {
      this.firestoreUnsub();
      this.firestoreUnsub = null;
    }
  }

  async load(): Promise<Character> {
    const user = this.auth.user();

    if (user) {
      try {
        const docRef = doc(db, 'characters', user.uid);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
          const data = snapshot.data() as Character;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
          return { ...createDefaultCharacter(), ...data };
        }
      } catch (e) {
        console.error('Failed to load from Firestore, falling back to localStorage', e);
      }
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return { ...createDefaultCharacter(), ...JSON.parse(raw) };
      }
    } catch (e) {
      console.error('Failed to load character from localStorage', e);
    }
    return createDefaultCharacter();
  }

  save(character: Character): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(character));

    const user = this.auth.user();
    if (user) {
      this._syncStatus.set('syncing');

      if (this.pendingSave) clearTimeout(this.pendingSave);
      this.pendingSave = setTimeout(async () => {
        try {
          const docRef = doc(db, 'characters', user.uid);
          await setDoc(docRef, JSON.parse(JSON.stringify(character)));
          this._syncStatus.set('synced');
        } catch (e) {
          console.error('Failed to save to Firestore', e);
          this._syncStatus.set('error');
        }
      }, 800);
    } else {
      this._syncStatus.set('offline');
    }
  }

  exportJson(character: Character): void {
    const blob = new Blob([JSON.stringify(character, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${character.identity.name || 'character'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importJson(file: File): Promise<Character> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string);
          resolve({ ...createDefaultCharacter(), ...data });
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  async reset(): Promise<Character> {
    localStorage.removeItem(STORAGE_KEY);

    const user = this.auth.user();
    if (user) {
      try {
        const docRef = doc(db, 'characters', user.uid);
        await setDoc(docRef, createDefaultCharacter());
      } catch (e) {
        console.error('Failed to reset Firestore document', e);
      }
    }

    return createDefaultCharacter();
  }
}
