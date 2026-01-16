import { Component } from '@angular/core';
import { CharacterSheetComponent } from './components/character-sheet/character-sheet.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CharacterSheetComponent],
  template: '<app-character-sheet />',
  styles: [],
})
export class App {}
