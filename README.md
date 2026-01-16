# Tales From the Loop — Feuille de personnage

Application Angular pour gérer ta feuille de personnage **Tales From the Loop**.

## Fonctionnalités

- **Édition en temps réel** — Modifie ton personnage directement; tout se sauvegarde automatiquement.
- **Sauvegarde locale** (localStorage) — Tes données restent dans ton navigateur.
- **Export / Import JSON** — Télécharge ta feuille pour la sauvegarder ailleurs (Drive, GitHub, etc.) ou la partager.
- **UI responsive** — Fonctionne sur desktop et mobile.

## Développement local

```bash
npm install
npm start
```

Ouvre http://localhost:4200/

## Build pour GitHub Pages

```bash
npm run build:ghpages
```

Le build est placé dans `dist/tftl-loop-sheet/browser`. Un workflow GitHub Actions est inclus pour déployer automatiquement sur GitHub Pages à chaque push sur `main`.

## Structure

```
src/
├── app/
│   ├── components/
│   │   ├── character-sheet/   # Composant principal
│   │   └── rating/            # Composant de notation par points
│   ├── models/
│   │   └── character.model.ts # Interface + factory
│   ├── services/
│   │   └── storage.service.ts # LocalStorage + import/export
│   ├── app.ts
│   └── app.config.ts
├── styles.scss                # Thème Angular Material + styles globaux
└── index.html
```

## Alternatives de persistance

| Option | Avantages | Inconvénients |
|--------|-----------|---------------|
| **localStorage** (actuel) | Simple, offline, zéro config | Limité à un navigateur |
| **IndexedDB** | Plus de stockage, requêtes avancées | Plus complexe |
| **Firebase Realtime DB / Firestore** | Sync multi-device, temps réel | Requiert compte Google, latence réseau |
| **Supabase** | Postgres, auth intégré, open-source | Hébergement externe |
| **GitHub Gist** | Versioning, partage facile | Auth OAuth requise |

Pour une solution simple multi-device, **Firebase** ou **Supabase** seraient de bons choix.
