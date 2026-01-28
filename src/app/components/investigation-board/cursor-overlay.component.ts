import { Component, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BoardPresenceService } from '../../services/board-presence.service';
import { UserPresence } from '../../models/investigation-board.model';

@Component({
  selector: 'app-cursor-overlay',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="cursor-overlay">
      @for (user of presenceService.otherUsers() | keyvalue; track user.key) {
        @if (user.value.cursorPosition) {
          <div
            class="remote-cursor"
            [style.left.px]="user.value.cursorPosition.x + canvasOffset().x"
            [style.top.px]="user.value.cursorPosition.y + canvasOffset().y"
            [style.--cursor-color]="user.value.color"
          >
            <svg class="cursor-icon" viewBox="0 0 24 24" width="20" height="20">
              <path
                d="M4 4l16 8-7 2-2 7z"
                [attr.fill]="user.value.color"
                stroke="white"
                stroke-width="1"
              />
            </svg>
            <span class="cursor-label" [style.background]="user.value.color">
              {{ user.value.odName }}
            </span>
          </div>
        }
      }
    </div>
  `,
  styles: `
    .cursor-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      overflow: hidden;
      z-index: 1000;
    }

    .remote-cursor {
      position: absolute;
      pointer-events: none;
      transition: left 0.1s ease-out, top 0.1s ease-out;
      z-index: 1001;
    }

    .cursor-icon {
      filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
    }

    .cursor-label {
      position: absolute;
      left: 16px;
      top: 16px;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
      color: white;
      white-space: nowrap;
      font-family: 'Epilogue', sans-serif;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }
  `,
})
export class CursorOverlayComponent {
  readonly presenceService = inject(BoardPresenceService);

  // Offset to account for header and canvas position
  readonly canvasOffset = input<{ x: number; y: number }>({ x: 0, y: 0 });
}
