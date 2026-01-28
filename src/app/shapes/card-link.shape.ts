import { dia, shapes, util } from '@joint/core';
import { LinkType } from '../models/investigation-board.model';

const LINK_COLORS: Record<LinkType, string> = {
  related: '#6d6258',
  'leads-to': '#f08b1a',
  contradicts: '#c44536',
  confirms: '#2d6a6a',
};

export interface CardLinkAttributes extends dia.Link.Attributes {
  linkId: string;
  linkType: LinkType;
  linkLabel?: string;
}

export class CardLinkShape extends dia.Link {
  override markup = util.svg/* xml */ `
    <path @selector="wrapper" fill="none" cursor="pointer" stroke="transparent" />
    <path @selector="line" fill="none" pointer-events="none" />
  `;

  override defaults() {
    return {
      ...super.defaults,
      type: 'tftl.CardLink',
      attrs: {
        line: {
          connection: true,
          stroke: LINK_COLORS.related,
          strokeWidth: 2,
          strokeLinejoin: 'round',
          strokeDasharray: '8 4',
          targetMarker: {
            type: 'path',
            d: 'M 10 -5 0 0 10 5 z',
            fill: LINK_COLORS.related,
          },
        },
        wrapper: {
          connection: true,
          strokeWidth: 20,
          strokeLinejoin: 'round',
        },
      },
    };
  }

  setLinkType(type: LinkType): void {
    const color = LINK_COLORS[type];
    this.attr({
      line: {
        stroke: color,
        targetMarker: {
          fill: color,
        },
      },
    });
    this.set('linkType', type);
  }

  setLinkLabel(label: string): void {
    this.set('linkLabel', label);
    if (label) {
      this.labels([
        {
          position: 0.5,
          attrs: {
            text: {
              text: label,
              fontFamily: '"Epilogue", sans-serif',
              fontSize: 11,
              fontWeight: 500,
              fill: '#1e1b16',
            },
            rect: {
              fill: '#fff4e1',
              stroke: '#1f140a',
              strokeWidth: 1,
              rx: 4,
              ry: 4,
            },
          },
        },
      ]);
    } else {
      this.labels([]);
    }
  }

  getLinkId(): string {
    return this.get('linkId') as string;
  }
}

// Register shape in namespace
(shapes as Record<string, Record<string, unknown>>)['tftl'] = {
  ...((shapes as Record<string, Record<string, unknown>>)['tftl'] || {}),
  CardLink: CardLinkShape,
};

export function createCardLinkShape(
  linkId: string,
  sourceId: string,
  targetId: string,
  linkType: LinkType,
  label?: string
): CardLinkShape {
  const link = new CardLinkShape({
    source: { id: sourceId },
    target: { id: targetId },
  });

  link.set('linkId', linkId);
  link.set('linkType', linkType);
  link.setLinkType(linkType);
  if (label) {
    link.setLinkLabel(label);
  }

  return link;
}
