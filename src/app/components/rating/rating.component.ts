import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-rating',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="rating" [class.wide]="wide()">
      @for (i of dots(); track i) {
        <button
          type="button"
          [class.active]="i <= value()"
          (click)="toggle(i)"
          [attr.aria-label]="'Set value to ' + i"
        ></button>
      }
    </div>
  `,
  styles: `
    .rating {
      display: inline-flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    button {
      width: 20px;
      height: 20px;
      border-radius: 6px;
      border: 2px solid #1f140a;
      background: #fff;
      cursor: pointer;
      transition:
        background 0.15s ease,
        transform 0.15s ease;
    }
    button.active {
      background: #f08b1a;
    }
    button:hover {
      transform: translateY(-1px);
    }
    button:focus-visible {
      outline: 2px dashed #c8610d;
      outline-offset: 2px;
    }
    .wide button {
      width: 22px;
    }
  `,
})
export class RatingComponent {
  readonly value = input<number>(0);
  readonly max = input<number>(5);
  readonly wide = input<boolean>(false);
  readonly valueChange = output<number>();

  dots() {
    return Array.from({ length: this.max() }, (_, i) => i + 1);
  }

  toggle(index: number) {
    const newValue = this.value() === index ? index - 1 : index;
    this.valueChange.emit(newValue);
  }
}
