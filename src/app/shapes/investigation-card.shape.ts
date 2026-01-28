import { dia, shapes, util } from '@joint/core';
import { CARD_COLORS, CardColor, CardType, CARD_TYPE_LABELS } from '../models/investigation-board.model';

const HEADER_HEIGHT = 32;
const BORDER_RADIUS = 18;
const BORDER_COLOR = '#1f140a';
const HEADER_COLOR = '#1f140a';
const HEADER_TEXT_COLOR = '#fff4e1';
const BODY_TEXT_COLOR = '#1e1b16';

export interface InvestigationCardAttributes extends dia.Element.Attributes {
  cardId: string;
  cardTitle: string;
  cardContent: string;
  cardType: CardType;
  cardColor: CardColor;
}

export class InvestigationCardShape extends dia.Element {
  override markup = util.svg/* xml */ `
    <rect @selector="body" />
    <rect @selector="header" />
    <rect @selector="headerMask" />
    <text @selector="title" />
    <text @selector="typeLabel" />
    <text @selector="content" />
  `;

  override defaults() {
    return {
      ...super.defaults,
      type: 'tftl.InvestigationCard',
      size: { width: 200, height: 150 },
      attrs: {
        body: {
          width: 'calc(w)',
          height: 'calc(h)',
          rx: BORDER_RADIUS,
          ry: BORDER_RADIUS,
          fill: CARD_COLORS.cream,
          stroke: BORDER_COLOR,
          strokeWidth: 2,
          filter: {
            name: 'dropShadow' as const,
            args: {
              dx: 2,
              dy: 4,
              blur: 8,
              color: 'rgba(40, 30, 18, 0.12)',
            },
          },
        },
        header: {
          width: 'calc(w)',
          height: HEADER_HEIGHT,
          fill: HEADER_COLOR,
          rx: BORDER_RADIUS,
          ry: BORDER_RADIUS,
        },
        headerMask: {
          width: 'calc(w)',
          height: HEADER_HEIGHT / 2,
          y: HEADER_HEIGHT / 2,
          fill: HEADER_COLOR,
        },
        title: {
          x: 12,
          y: HEADER_HEIGHT / 2 + 1,
          textVerticalAnchor: 'middle',
          textAnchor: 'start',
          fontFamily: '"Bebas Neue", sans-serif',
          fontSize: 16,
          letterSpacing: '0.5px',
          fill: HEADER_TEXT_COLOR,
          text: 'New Card',
        },
        typeLabel: {
          x: 'calc(w - 12)',
          y: HEADER_HEIGHT / 2 + 1,
          textVerticalAnchor: 'middle',
          textAnchor: 'end',
          fontFamily: '"Epilogue", sans-serif',
          fontSize: 10,
          fontWeight: 500,
          fill: HEADER_TEXT_COLOR,
          opacity: 0.7,
          text: 'NOTE',
        },
        content: {
          x: 12,
          y: HEADER_HEIGHT + 12,
          textVerticalAnchor: 'top',
          textAnchor: 'start',
          fontFamily: '"Epilogue", sans-serif',
          fontSize: 12,
          lineHeight: 1.4,
          fill: BODY_TEXT_COLOR,
          text: '',
          textWrap: {
            width: -24,
            height: -HEADER_HEIGHT - 24,
            ellipsis: true,
          },
        },
      },
    };
  }

  setCardColor(color: CardColor): void {
    this.attr('body/fill', CARD_COLORS[color]);
    this.set('cardColor', color);
  }

  setCardTitle(title: string): void {
    this.attr('title/text', title);
    this.set('cardTitle', title);
  }

  setCardContent(content: string): void {
    this.attr('content/text', content);
    this.set('cardContent', content);
  }

  setCardType(type: CardType): void {
    this.attr('typeLabel/text', CARD_TYPE_LABELS[type].toUpperCase());
    this.set('cardType', type);
  }

  getCardId(): string {
    return this.get('cardId') as string;
  }
}

// Register shape in namespace
(shapes as Record<string, Record<string, unknown>>)['tftl'] = {
  ...((shapes as Record<string, Record<string, unknown>>)['tftl'] || {}),
  InvestigationCard: InvestigationCardShape,
};

export function createInvestigationCardShape(
  cardId: string,
  title: string,
  content: string,
  cardType: CardType,
  cardColor: CardColor,
  position: { x: number; y: number },
  size: { width: number; height: number }
): InvestigationCardShape {
  const card = new InvestigationCardShape({
    position,
    size,
    cardId,
    cardTitle: title,
    cardContent: content,
    cardType,
    cardColor,
  });

  card.setCardTitle(title);
  card.setCardContent(content);
  card.setCardType(cardType);
  card.setCardColor(cardColor);

  return card;
}
