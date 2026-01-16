import { Injectable, signal } from '@angular/core';
import { Character, createDefaultCharacter } from '../models/character.model';

const STORAGE_KEY = 'tftl_character';

@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly _saveStatus = signal<'saved' | 'saving' | 'error'>('saved');
  readonly saveStatus = this._saveStatus.asReadonly();

  load(): Character {
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
    this._saveStatus.set('saving');
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(character));
      this._saveStatus.set('saved');
    } catch (e) {
      console.error('Failed to save character to localStorage', e);
      this._saveStatus.set('error');
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

  reset(): Character {
    localStorage.removeItem(STORAGE_KEY);
    return createDefaultCharacter();
  }
}
