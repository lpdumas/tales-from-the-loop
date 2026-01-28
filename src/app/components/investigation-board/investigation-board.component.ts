import {
  Component,
  ElementRef,
  ViewChild,
  OnInit,
  OnDestroy,
  inject,
  signal,
  effect,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { dia, shapes } from '@joint/core';

import { AuthService } from '../../services/auth.service';
import { BoardService } from '../../services/board.service';
import {
  InvestigationCard,
  CardLink,
  CardColor,
  CardType,
  CARD_COLORS,
  CARD_TYPE_LABELS,
} from '../../models/investigation-board.model';
import {
  InvestigationCardShape,
  createInvestigationCardShape,
} from '../../shapes/investigation-card.shape';
import { CardLinkShape, createCardLinkShape } from '../../shapes/card-link.shape';
import { CardDialogComponent, CardDialogData } from './card-dialog.component';
import { BoardSyncIndicatorComponent } from './board-sync-indicator.component';

@Component({
  selector: 'app-investigation-board',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatDialogModule,
    MatTooltipModule,
    RouterModule,
    BoardSyncIndicatorComponent,
  ],
  templateUrl: './investigation-board.component.html',
  styleUrl: './investigation-board.component.scss',
})
export class InvestigationBoardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLDivElement>;

  readonly auth = inject(AuthService);
  readonly boardService = inject(BoardService);
  private readonly dialog = inject(MatDialog);

  private graph!: dia.Graph;
  private paper!: dia.Paper;

  readonly isLinking = signal(false);
  private linkSourceId: string | null = null;

  readonly selectedCardId = signal<string | null>(null);

  readonly cardColors = Object.entries(CARD_COLORS).map(([key, value]) => ({
    key: key as CardColor,
    value,
  }));
  readonly cardTypes = Object.entries(CARD_TYPE_LABELS).map(([key, value]) => ({
    key: key as CardType,
    label: value,
  }));

  private shapeToCardId = new Map<string, string>();
  private cardIdToShape = new Map<string, string>();
  private linkIdToShape = new Map<string, string>();
  private shapeToLinkId = new Map<string, string>();

  private updateTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const cards = this.boardService.cards();
      const links = this.boardService.links();
      if (this.graph) {
        this.syncGraphFromFirestore(cards, links);
      }
    });
  }

  ngOnInit(): void {
    this.initGraph();
  }

  ngAfterViewInit(): void {
    this.initPaper();
  }

  ngOnDestroy(): void {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
    this.paper?.remove();
  }

  private initGraph(): void {
    this.graph = new dia.Graph({}, { cellNamespace: shapes });
  }

  private initPaper(): void {
    this.paper = new dia.Paper({
      el: this.canvasRef.nativeElement,
      model: this.graph,
      width: '100%',
      height: '100%',
      gridSize: 20,
      drawGrid: { name: 'dot', args: { color: 'rgba(30, 27, 22, 0.1)' } },
      background: { color: 'transparent' },
      async: true,
      cellViewNamespace: shapes,
      defaultLink: () => new CardLinkShape(),
      interactive: ((cellView: dia.CellView) => {
        if (cellView.model instanceof CardLinkShape) {
          return { vertexAdd: false };
        }
        return true;
      }) as dia.Paper.Options['interactive'],
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Double-click on blank area to add card
    this.paper.on('blank:pointerdblclick', (evt, x, y) => {
      this.addCard(x, y);
    });

    // Single click to select/deselect
    this.paper.on('element:pointerclick', (cellView) => {
      const cardId = this.shapeToCardId.get(cellView.model.id as string);
      if (!cardId) return;

      if (this.isLinking()) {
        if (this.linkSourceId && this.linkSourceId !== cardId) {
          this.boardService.addLink(this.linkSourceId, cardId);
          this.cancelLinking();
        }
      } else {
        this.selectedCardId.set(cardId);
      }
    });

    // Double-click on card to edit
    this.paper.on('element:pointerdblclick', (cellView) => {
      const cardId = this.shapeToCardId.get(cellView.model.id as string);
      if (cardId) {
        this.editCard(cardId);
      }
    });

    // Deselect on blank click
    this.paper.on('blank:pointerclick', () => {
      this.selectedCardId.set(null);
      this.cancelLinking();
    });

    // Handle position changes (drag end)
    this.graph.on('change:position', (cell: dia.Cell) => {
      if (cell instanceof InvestigationCardShape) {
        const cardId = this.shapeToCardId.get(cell.id as string);
        if (cardId) {
          const pos = cell.position();
          // Convert JointJS Point to plain object for Firestore
          const position = { x: pos.x, y: pos.y };
          // Debounce position updates (400ms component-level)
          if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
          }
          this.updateTimeout = setTimeout(() => {
            this.boardService.updateCard(cardId, { position });
          }, 400);
        }
      }
    });

    // Handle link connections
    this.paper.on('link:connect', (linkView) => {
      const sourceId = linkView.model.source().id;
      const targetId = linkView.model.target().id;
      if (sourceId && targetId) {
        const sourceCardId = this.shapeToCardId.get(String(sourceId));
        const targetCardId = this.shapeToCardId.get(String(targetId));
        if (sourceCardId && targetCardId) {
          this.boardService.addLink(sourceCardId, targetCardId);
        }
      }
      // Remove temporary link, Firestore will sync the real one
      linkView.model.remove();
    });

    // Click on link to select/delete
    this.paper.on('link:pointerclick', (linkView) => {
      const linkId = this.shapeToLinkId.get(linkView.model.id as string);
      if (linkId && confirm('Delete this connection?')) {
        this.boardService.deleteLink(linkId);
      }
    });
  }

  private syncGraphFromFirestore(
    cards: Map<string, InvestigationCard>,
    links: Map<string, CardLink>
  ): void {
    // Track existing shapes
    const existingShapeIds = new Set(this.cardIdToShape.keys());
    const existingLinkIds = new Set(this.linkIdToShape.keys());

    // Update or create card shapes
    for (const [cardId, card] of cards) {
      existingShapeIds.delete(cardId);
      const shapeId = this.cardIdToShape.get(cardId);

      if (shapeId) {
        // Update existing shape
        const shape = this.graph.getCell(shapeId) as InvestigationCardShape;
        if (shape) {
          const currentPos = shape.position();
          // Only update position if significantly different (avoid jitter)
          if (
            Math.abs(currentPos.x - card.position.x) > 5 ||
            Math.abs(currentPos.y - card.position.y) > 5
          ) {
            shape.position(card.position.x, card.position.y);
          }
          shape.setCardTitle(card.title);
          shape.setCardContent(card.content);
          shape.setCardType(card.cardType);
          shape.setCardColor(card.color);
        }
      } else {
        // Create new shape
        const shape = createInvestigationCardShape(
          cardId,
          card.title,
          card.content,
          card.cardType,
          card.color,
          card.position,
          card.size
        );
        this.graph.addCell(shape);
        this.shapeToCardId.set(shape.id as string, cardId);
        this.cardIdToShape.set(cardId, shape.id as string);
      }
    }

    // Remove deleted cards
    for (const cardId of existingShapeIds) {
      const shapeId = this.cardIdToShape.get(cardId);
      if (shapeId) {
        const cell = this.graph.getCell(shapeId);
        if (cell) cell.remove();
        this.cardIdToShape.delete(cardId);
        this.shapeToCardId.delete(shapeId);
      }
    }

    // Update or create link shapes
    for (const [linkId, link] of links) {
      existingLinkIds.delete(linkId);
      const shapeId = this.linkIdToShape.get(linkId);

      if (!shapeId) {
        const sourceShapeId = this.cardIdToShape.get(link.sourceCardId);
        const targetShapeId = this.cardIdToShape.get(link.targetCardId);

        if (sourceShapeId && targetShapeId) {
          const linkShape = createCardLinkShape(
            linkId,
            sourceShapeId,
            targetShapeId,
            link.linkType,
            link.label
          );
          this.graph.addCell(linkShape);
          this.linkIdToShape.set(linkId, linkShape.id as string);
          this.shapeToLinkId.set(linkShape.id as string, linkId);
        }
      }
    }

    // Remove deleted links
    for (const linkId of existingLinkIds) {
      const shapeId = this.linkIdToShape.get(linkId);
      if (shapeId) {
        const cell = this.graph.getCell(shapeId);
        if (cell) cell.remove();
        this.linkIdToShape.delete(linkId);
        this.shapeToLinkId.delete(shapeId);
      }
    }
  }

  async addCard(x: number = 100, y: number = 100): Promise<void> {
    await this.boardService.addCard({ x, y });
  }

  editCard(cardId: string): void {
    const card = this.boardService.cards().get(cardId);
    if (!card) return;

    const dialogRef = this.dialog.open(CardDialogComponent, {
      width: '400px',
      data: {
        title: card.title,
        content: card.content,
        cardType: card.cardType,
        color: card.color,
      } as CardDialogData,
    });

    dialogRef.afterClosed().subscribe((result: CardDialogData | undefined) => {
      if (result) {
        this.boardService.updateCard(cardId, {
          title: result.title,
          content: result.content,
          cardType: result.cardType,
          color: result.color,
        });
      }
    });
  }

  deleteSelectedCard(): void {
    const cardId = this.selectedCardId();
    if (cardId) {
      this.boardService.deleteCard(cardId);
      this.selectedCardId.set(null);
    }
  }

  startLinking(): void {
    const cardId = this.selectedCardId();
    if (cardId) {
      this.isLinking.set(true);
      this.linkSourceId = cardId;
    }
  }

  cancelLinking(): void {
    this.isLinking.set(false);
    this.linkSourceId = null;
  }

  setCardColor(color: CardColor): void {
    const cardId = this.selectedCardId();
    if (cardId) {
      this.boardService.updateCard(cardId, { color });
    }
  }

  setCardType(type: CardType): void {
    const cardId = this.selectedCardId();
    if (cardId) {
      this.boardService.updateCard(cardId, { cardType: type });
    }
  }
}
