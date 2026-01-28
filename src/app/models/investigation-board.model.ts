import { Timestamp } from 'firebase/firestore';

export type CardType = 'clue' | 'person' | 'location' | 'event' | 'theory' | 'note';
export type CardColor = 'cream' | 'orange' | 'brown' | 'red' | 'teal' | 'purple';
export type LinkType = 'related' | 'leads-to' | 'contradicts' | 'confirms';
export type BoardRole = 'owner' | 'editor' | 'viewer';

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

export interface BoardMember {
  odId: string;
  odName: string;
  odEmail: string;
  odPhotoURL?: string;
  role: BoardRole;
  joinedAt: Timestamp;
}

export interface BoardMetadata {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  members: Record<string, BoardMember>; // odId -> member info
  shareCode?: string; // For invite links
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface UserPresence {
  odId: string;
  odName: string;
  odPhotoURL?: string;
  cursorPosition?: { x: number; y: number };
  selectedCardId?: string;
  editingCardId?: string;
  lastSeen: Timestamp;
  color: string;
  isOnline: boolean;
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

// Couleurs pour les curseurs des collaborateurs
export const PRESENCE_COLORS = [
  '#e91e63', // Pink
  '#9c27b0', // Purple
  '#3f51b5', // Indigo
  '#03a9f4', // Light Blue
  '#009688', // Teal
  '#4caf50', // Green
  '#ff9800', // Orange
  '#795548', // Brown
];

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
  ownerName: string,
  ownerEmail: string,
  name: string = 'Investigation Board'
): Omit<BoardMetadata, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name,
    ownerId,
    ownerName,
    ownerEmail,
    members: {
      [ownerId]: {
        odId: ownerId,
        odName: ownerName,
        odEmail: ownerEmail,
        role: 'owner',
        joinedAt: null as unknown as Timestamp, // Will be set by serverTimestamp
      },
    },
  };
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function generateShareCode(): string {
  // Generate a short, readable share code
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function getPresenceColor(odId: string): string {
  // Consistent color based on user ID hash
  let hash = 0;
  for (let i = 0; i < odId.length; i++) {
    hash = ((hash << 5) - hash) + odId.charCodeAt(i);
    hash = hash & hash;
  }
  return PRESENCE_COLORS[Math.abs(hash) % PRESENCE_COLORS.length];
}
