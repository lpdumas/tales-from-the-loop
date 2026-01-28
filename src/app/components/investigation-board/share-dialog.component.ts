import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { BoardService } from '../../services/board.service';

@Component({
  selector: 'app-share-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
  ],
  template: `
    <h2 mat-dialog-title>Share Board</h2>
    <mat-dialog-content>
      <div class="share-section">
        <h3>Invite Link</h3>
        <p class="description">Share this code with others to let them join your board.</p>

        @if (shareCode()) {
          <div class="share-code-display">
            <span class="code">{{ shareCode() }}</span>
            <button mat-icon-button (click)="copyCode()" matTooltip="Copy code">
              <mat-icon>content_copy</mat-icon>
            </button>
          </div>
          <div class="share-url">
            <input
              matInput
              readonly
              [value]="getShareUrl()"
              #shareUrlInput
            />
            <button mat-icon-button (click)="copyUrl(shareUrlInput)" matTooltip="Copy URL">
              <mat-icon>link</mat-icon>
            </button>
          </div>
        } @else {
          <button mat-stroked-button (click)="generateCode()" [disabled]="generating()">
            @if (generating()) {
              <mat-icon class="spinning">sync</mat-icon>
            } @else {
              <mat-icon>add_link</mat-icon>
            }
            Generate Invite Link
          </button>
        }
      </div>

      <div class="share-section">
        <h3>Join a Board</h3>
        <p class="description">Enter an invite code to join someone else's board.</p>

        <div class="join-form">
          <mat-form-field appearance="outline">
            <mat-label>Invite Code</mat-label>
            <input
              matInput
              [(ngModel)]="joinCode"
              placeholder="e.g., AB12CD34"
              maxlength="8"
            />
          </mat-form-field>
          <button
            mat-raised-button
            color="primary"
            (click)="joinBoard()"
            [disabled]="!joinCode || joining()"
          >
            @if (joining()) {
              <mat-icon class="spinning">sync</mat-icon>
            } @else {
              <mat-icon>login</mat-icon>
            }
            Join
          </button>
        </div>
      </div>

      @if (boardService.boardMetadata(); as board) {
        <div class="share-section members-section">
          <h3>Members ({{ getMemberCount(board.members) }})</h3>
          <div class="members-list">
            @for (member of getMembersList(board.members); track member.odId) {
              <div class="member-item">
                <div class="member-info">
                  @if (member.odPhotoURL) {
                    <img [src]="member.odPhotoURL" class="avatar" alt="" />
                  } @else {
                    <div class="avatar placeholder">{{ member.odName.charAt(0) }}</div>
                  }
                  <div class="member-details">
                    <span class="name">{{ member.odName }}</span>
                    <span class="role">{{ member.role }}</span>
                  </div>
                </div>
                @if (member.role !== 'owner' && board.ownerId === currentUserId()) {
                  <button
                    mat-icon-button
                    color="warn"
                    (click)="removeMember(member.odId)"
                    matTooltip="Remove member"
                  >
                    <mat-icon>person_remove</mat-icon>
                  </button>
                }
              </div>
            }
          </div>
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: `
    mat-dialog-content {
      min-width: 380px;
      max-height: 70vh;
    }

    .share-section {
      margin-bottom: 24px;

      h3 {
        margin: 0 0 4px 0;
        font-size: 14px;
        font-weight: 600;
        color: #1e1b16;
      }

      .description {
        margin: 0 0 12px 0;
        font-size: 12px;
        color: #6d6258;
      }
    }

    .share-code-display {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;

      .code {
        font-family: 'Bebas Neue', monospace;
        font-size: 28px;
        letter-spacing: 4px;
        color: #f08b1a;
        background: rgba(240, 139, 26, 0.1);
        padding: 8px 16px;
        border-radius: 8px;
        border: 2px dashed rgba(240, 139, 26, 0.3);
      }
    }

    .share-url {
      display: flex;
      align-items: center;
      gap: 4px;

      input {
        flex: 1;
        font-size: 12px;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: #f5f5f5;
      }
    }

    .join-form {
      display: flex;
      gap: 12px;
      align-items: flex-start;

      mat-form-field {
        flex: 1;
      }

      button {
        margin-top: 4px;
      }
    }

    .members-section {
      border-top: 1px solid #eee;
      padding-top: 16px;
    }

    .members-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .member-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px;
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.02);

      .member-info {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        object-fit: cover;

        &.placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f08b1a;
          color: white;
          font-weight: 600;
        }
      }

      .member-details {
        display: flex;
        flex-direction: column;

        .name {
          font-weight: 500;
          font-size: 14px;
        }

        .role {
          font-size: 11px;
          color: #6d6258;
          text-transform: capitalize;
        }
      }
    }

    .spinning {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `,
})
export class ShareDialogComponent {
  readonly boardService = inject(BoardService);
  private readonly dialogRef = inject(MatDialogRef<ShareDialogComponent>);
  private readonly snackBar = inject(MatSnackBar);

  readonly shareCode = signal<string | null>(null);
  readonly generating = signal(false);
  readonly joining = signal(false);

  joinCode = '';

  constructor() {
    // Load existing share code if available
    const board = this.boardService.boardMetadata();
    if (board?.shareCode) {
      this.shareCode.set(board.shareCode);
    }
  }

  currentUserId(): string {
    return this.boardService.boardMetadata()?.ownerId || '';
  }

  async generateCode(): Promise<void> {
    this.generating.set(true);
    const code = await this.boardService.generateShareLink();
    if (code) {
      this.shareCode.set(code);
      this.snackBar.open('Share code generated!', 'OK', { duration: 2000 });
    } else {
      this.snackBar.open('Failed to generate code', 'OK', { duration: 2000 });
    }
    this.generating.set(false);
  }

  getShareUrl(): string {
    const code = this.shareCode();
    if (!code) return '';
    return `${window.location.origin}/board?join=${code}`;
  }

  copyCode(): void {
    const code = this.shareCode();
    if (code) {
      navigator.clipboard.writeText(code);
      this.snackBar.open('Code copied!', 'OK', { duration: 1500 });
    }
  }

  copyUrl(input: HTMLInputElement): void {
    navigator.clipboard.writeText(input.value);
    this.snackBar.open('URL copied!', 'OK', { duration: 1500 });
  }

  async joinBoard(): Promise<void> {
    if (!this.joinCode) return;

    this.joining.set(true);
    const boardId = await this.boardService.joinBoardByCode(this.joinCode.toUpperCase());
    if (boardId) {
      this.snackBar.open('Successfully joined board!', 'OK', { duration: 2000 });
      this.dialogRef.close();
    } else {
      this.snackBar.open('Invalid code or failed to join', 'OK', { duration: 2000 });
    }
    this.joining.set(false);
  }

  getMemberCount(members: Record<string, unknown>): number {
    return Object.keys(members || {}).length;
  }

  getMembersList(members: Record<string, unknown>): Array<{
    odId: string;
    odName: string;
    odPhotoURL?: string;
    role: string;
  }> {
    return Object.values(members || {}) as Array<{
      odId: string;
      odName: string;
      odPhotoURL?: string;
      role: string;
    }>;
  }

  async removeMember(memberId: string): Promise<void> {
    if (confirm('Remove this member from the board?')) {
      await this.boardService.removeMember(memberId);
      this.snackBar.open('Member removed', 'OK', { duration: 2000 });
    }
  }
}
