import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StorageService, SyncStatus } from '../../services/storage.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-sync-indicator',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (auth.isLoggedIn()) {
      <div class="sync-indicator" [class]="syncStatus()">
        <span class="icon">
          @switch (syncStatus()) {
            @case ('syncing') {
              ⟳
            }
            @case ('synced') {
              ☁
            }
            @case ('error') {
              ⚠
            }
            @default {
              ○
            }
          }
        </span>
        <span class="label">
          @switch (syncStatus()) {
            @case ('syncing') {
              Synchronisation...
            }
            @case ('synced') {
              Synchronisé
            }
            @case ('error') {
              Erreur de sync
            }
            @default {
              Hors ligne
            }
          }
        </span>
      </div>
    } @else {
      <div class="sync-indicator offline">
        <span class="icon">○</span>
        <span class="label">Local uniquement</span>
      </div>
    }
  `,
  styles: `
    .sync-indicator {
      position: fixed;
      bottom: 24px;
      right: 24px;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      border-radius: 999px;
      font-size: 0.8rem;
      font-weight: 500;
      background: rgba(255, 255, 255, 0.95);
      border: 1px solid rgba(0, 0, 0, 0.1);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
      backdrop-filter: blur(10px);
      transition: all 0.3s ease;
      z-index: 1000;
    }

    .icon {
      font-size: 1rem;
      line-height: 1;
    }

    .syncing {
      background: rgba(255, 193, 7, 0.15);
      border-color: rgba(255, 193, 7, 0.3);
      color: #856404;
    }

    .syncing .icon {
      animation: spin 1s linear infinite;
    }

    .synced {
      background: rgba(40, 167, 69, 0.15);
      border-color: rgba(40, 167, 69, 0.3);
      color: #155724;
    }

    .error {
      background: rgba(220, 53, 69, 0.15);
      border-color: rgba(220, 53, 69, 0.3);
      color: #721c24;
    }

    .offline {
      background: rgba(108, 117, 125, 0.1);
      border-color: rgba(108, 117, 125, 0.2);
      color: #6c757d;
    }

    @keyframes spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }
  `,
})
export class SyncIndicatorComponent {
  readonly auth = inject(AuthService);
  readonly syncStatus = inject(StorageService).syncStatus;
}
