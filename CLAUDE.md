# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Angular application for the **Tales From the Loop** tabletop RPG. Two main features:
1. **Character Sheet** (`/`) — editable character sheet with auto-save
2. **Investigation Board** (`/board`) — collaborative canvas with cards, links, and real-time presence (built on JointJS)

## Commands

```bash
npm start              # Dev server at http://localhost:4200/
npm run build          # Production build
npm run build:ghpages  # Build for GitHub Pages (sets base-href, creates 404.html)
npm test               # Run tests (Vitest via @angular/build:unit-test)
```

## Tech Stack

- **Angular 21** (standalone components, signals, lazy-loaded routes)
- **Angular Material** (M2 theme — orange/brown palette, SCSS)
- **Firebase** (Auth via Google sign-in, Firestore for persistence) — uses the modular Firebase SDK directly (no AngularFire)
- **JointJS** (`@joint/core`) — powers the investigation board canvas with custom shapes
- **Vitest** — test runner (configured through Angular CLI's `@angular/build:unit-test`)
- **TypeScript strict mode** enabled

## Architecture

### Data Flow
- **Character Sheet**: `StorageService` saves to localStorage immediately, then debounces (800ms) to Firestore when authenticated. Falls back to localStorage when offline.
- **Investigation Board**: `BoardService` uses Firestore real-time listeners (`onSnapshot`) for cards, links, and board metadata. Card updates are optimistic (local signal updated immediately) + debounced to Firestore.
- **Presence**: `BoardPresenceService` tracks collaborator cursors, selected/editing cards via a `boards/{boardId}/presence` subcollection with heartbeat/cleanup.

### Firebase Structure (Firestore)
- `characters/{uid}` — per-user character data (owner-only access)
- `boards/{boardId}` — board metadata, members map, memberIds array, shareCode
- `boards/{boardId}/cards/{cardId}` — investigation cards
- `boards/{boardId}/links/{linkId}` — card-to-card links
- `boards/{boardId}/presence/{uid}` — ephemeral presence data

### Key Patterns
- Firebase is initialized in `src/app/firebase.config.ts` as plain exports (`auth`, `db`), not through Angular DI
- Services use Angular `signal()` for state and `effect()` for reactive subscriptions
- Components are all standalone with lazy loading via `loadComponent` in routes
- JointJS custom shapes defined in `src/app/shapes/` (InvestigationCardShape, CardLinkShape)
- Board sharing uses an 8-char alphanumeric share code; members have roles: owner/editor/viewer

### Prettier Config
Configured inline in `package.json`: 100 char print width, single quotes, Angular HTML parser for `.html` files.

## Deployment

GitHub Actions workflow (`.github/workflows/deploy.yml`) auto-deploys to GitHub Pages on push to `main`. Output goes to `dist/tftl-loop-sheet/browser`.
