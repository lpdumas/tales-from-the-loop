import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { Character, createDefaultCharacter } from '../../models/character.model';
import { StorageService } from '../../services/storage.service';
import { RatingComponent } from '../rating/rating.component';

@Component({
  selector: 'app-character-sheet',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatInputModule,
    MatFormFieldModule,
    MatCheckboxModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatChipsModule,
    MatSnackBarModule,
    RatingComponent,
  ],
  templateUrl: './character-sheet.component.html',
  styleUrl: './character-sheet.component.scss',
})
export class CharacterSheetComponent {
  private readonly storage = inject(StorageService);
  private readonly snackBar = inject(MatSnackBar);

  readonly char = signal<Character>(this.storage.load());
  readonly saveStatus = this.storage.saveStatus;

  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const c = this.char();
      if (this.saveTimeout) clearTimeout(this.saveTimeout);
      this.saveTimeout = setTimeout(() => this.storage.save(c), 400);
    });
  }

  updateIdentity<K extends keyof Character['identity']>(key: K, value: Character['identity'][K]) {
    this.char.update((c) => ({ ...c, identity: { ...c.identity, [key]: value } }));
  }

  updateStat<K extends keyof Character['stats']>(key: K, value: number) {
    this.char.update((c) => ({ ...c, stats: { ...c.stats, [key]: value } }));
  }

  updateSkill<K extends keyof Character['skills']>(key: K, value: number) {
    this.char.update((c) => ({ ...c, skills: { ...c.skills, [key]: value } }));
  }

  updateCondition<K extends keyof Character['conditions']>(key: K, value: boolean) {
    this.char.update((c) => ({ ...c, conditions: { ...c.conditions, [key]: value } }));
  }

  updateRelationship(index: number, name: string) {
    this.char.update((c) => {
      const relationships = [...c.relationships];
      relationships[index] = { ...relationships[index], name };
      return { ...c, relationships };
    });
  }

  updateItem(index: number, name: string) {
    this.char.update((c) => {
      const items = [...c.items];
      items[index] = { ...items[index], name };
      return { ...c, items };
    });
  }

  updateItemUse(itemIndex: number, useIndex: number, value: boolean) {
    this.char.update((c) => {
      const items = [...c.items];
      const uses = [...items[itemIndex].uses];
      uses[useIndex] = value;
      items[itemIndex] = { ...items[itemIndex], uses };
      return { ...c, items };
    });
  }

  updateField<K extends keyof Character>(key: K, value: Character[K]) {
    this.char.update((c) => ({ ...c, [key]: value }));
  }

  exportJson() {
    this.storage.exportJson(this.char());
    this.snackBar.open('Fichier exporté!', 'OK', { duration: 2000 });
  }

  async importJson(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const data = await this.storage.importJson(file);
      this.char.set(data);
      this.snackBar.open('Personnage importé!', 'OK', { duration: 2000 });
    } catch {
      this.snackBar.open("Erreur lors de l'importation", 'OK', { duration: 3000 });
    }
    input.value = '';
  }

  reset() {
    if (confirm('Réinitialiser le personnage? Les données seront perdues.')) {
      this.char.set(this.storage.reset());
      this.snackBar.open('Personnage réinitialisé', 'OK', { duration: 2000 });
    }
  }
}
