import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/character-sheet/character-sheet.component').then(
        (m) => m.CharacterSheetComponent
      ),
  },
  {
    path: 'board',
    loadComponent: () =>
      import('./components/investigation-board/investigation-board.component').then(
        (m) => m.InvestigationBoardComponent
      ),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
