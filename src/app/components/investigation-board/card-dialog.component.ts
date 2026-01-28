import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import {
  CardColor,
  CardType,
  CARD_COLORS,
  CARD_TYPE_LABELS,
} from '../../models/investigation-board.model';

export interface CardDialogData {
  title: string;
  content: string;
  cardType: CardType;
  color: CardColor;
}

@Component({
  selector: 'app-card-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
  ],
  template: `
    <h2 mat-dialog-title>Edit Card</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Title</mat-label>
        <input matInput [(ngModel)]="data.title" placeholder="Card title" />
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Content</mat-label>
        <textarea
          matInput
          [(ngModel)]="data.content"
          placeholder="Write your notes here..."
          rows="5"
        ></textarea>
      </mat-form-field>

      <div class="row">
        <mat-form-field appearance="outline">
          <mat-label>Type</mat-label>
          <mat-select [(ngModel)]="data.cardType">
            @for (type of cardTypes; track type.key) {
              <mat-option [value]="type.key">{{ type.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Color</mat-label>
          <mat-select [(ngModel)]="data.color">
            @for (color of cardColors; track color.key) {
              <mat-option [value]="color.key">
                <span class="color-option">
                  <span class="color-swatch" [style.background]="color.value"></span>
                  {{ color.key | titlecase }}
                </span>
              </mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" [mat-dialog-close]="data">Save</button>
    </mat-dialog-actions>
  `,
  styles: `
    mat-dialog-content {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 350px;
    }

    .full-width {
      width: 100%;
    }

    .row {
      display: flex;
      gap: 16px;

      mat-form-field {
        flex: 1;
      }
    }

    .color-option {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .color-swatch {
      display: inline-block;
      width: 16px;
      height: 16px;
      border-radius: 4px;
      border: 1px solid rgba(0, 0, 0, 0.2);
    }

    mat-dialog-actions {
      padding: 16px 24px;
    }
  `,
})
export class CardDialogComponent {
  readonly dialogRef = inject(MatDialogRef<CardDialogComponent>);
  readonly data: CardDialogData = inject(MAT_DIALOG_DATA);

  readonly cardTypes = Object.entries(CARD_TYPE_LABELS).map(([key, label]) => ({
    key: key as CardType,
    label,
  }));

  readonly cardColors = Object.entries(CARD_COLORS).map(([key, value]) => ({
    key: key as CardColor,
    value,
  }));
}
