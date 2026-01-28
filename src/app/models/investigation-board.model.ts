import { Timestamp } from 'firebase/firestore';

export type CardType = 'clue' | 'person' | 'location' | 'event' | 'theory' | 'note';
export type CardColor = 'cream' | 'orange' | 'brown' | 'red' | 'teal' | 'purple';
export type LinkType = 'related' | 'leads-to' | 'contradicts' | 'confirms';

export interface OperationMetadata {
  operationId: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

export interface InvestigationCard {
  id: string;
  boardId: string;
  title: string;
  content: string;
  cardType: CardType;
  color: CardColor;
  position: { x: number; y: number };
  size: { width: number; height: number };
  meta: {
    createdBy: string;
    updatedBy: string;
    updatedAt: Timestamp;
    fieldVersions: Record<string, OperationMetadata>;
  };
}

export interface CardLink {
  id: string;
  boardId: string;
  sourceCardId: string;
  targetCardId: string;
  label?: string;
  linkType: LinkType;
}

export interface BoardMetadata {
  id: string;
  name: string;
  ownerId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface UserPresence {
  odId: string;
  odName: string;
  cursorPosition?: { x: number; y: number };
  selectedCardId?: string;
  lastSeen: Timestamp;
  color: string;
}

export const CARD_COLORS: Record<CardColor, string> = {
  cream: '#fff4e1',
  orange: '#f08b1a',
  brown: '#8b6914',
  red: '#c44536',
  teal: '#2d6a6a',
  purple: '#6b4c7a',
};

export const CARD_TYPE_LABELS: Record<CardType, string> = {
  clue: 'Clue',
  person: 'Person',
  location: 'Location',
  event: 'Event',
  theory: 'Theory',
  note: 'Note',
};

export const LINK_TYPE_LABELS: Record<LinkType, string> = {
  related: 'Related',
  'leads-to': 'Leads to',
  contradicts: 'Contradicts',
  confirms: 'Confirms',
};

export const DEFAULT_CARD_SIZE = { width: 200, height: 150 };

export function createDefaultCard(
  boardId: string,
  userId: string,
  position: { x: number; y: number } = { x: 100, y: 100 }
): Omit<InvestigationCard, 'id' | 'meta'> & { meta: Omit<InvestigationCard['meta'], 'updatedAt' | 'fieldVersions'> } {
  return {
    boardId,
    title: 'New Card',
    content: '',
    cardType: 'note',
    color: 'cream',
    position,
    size: { ...DEFAULT_CARD_SIZE },
    meta: {
      createdBy: userId,
      updatedBy: userId,
    },
  };
}

export function createDefaultLink(
  boardId: string,
  sourceCardId: string,
  targetCardId: string
): Omit<CardLink, 'id'> {
  return {
    boardId,
    sourceCardId,
    targetCardId,
    linkType: 'related',
  };
}

export function createDefaultBoard(
  ownerId: string,
  name: string = 'Investigation Board'
): Omit<BoardMetadata, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name,
    ownerId,
  };
}

export function generateId(): string {
  return crypto.randomUUID();
}
