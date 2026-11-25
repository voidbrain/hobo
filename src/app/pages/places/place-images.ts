import { Component, input, output } from '@angular/core';

/** Place photo picker and thumbnail strip. Tokens only; data flows via inputs and outputs. */
@Component({
  selector: 'hobo-place-images',
  template: `
    <div class="photos">
      <label class="picker">
        <span>Add photos</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          [disabled]="busy()"
          (change)="onFileChange($event)"
        />
      </label>

      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }

      @if (images().length > 0) {
        <ul class="grid">
          @for (name of images(); track name; let idx = $index) {
            <li class="item">
              <img
                class="thumb"
                [src]="imageSrc(name)"
                [alt]="placeName() + ' photo ' + (idx + 1)"
                width="120"
                height="90"
                loading="lazy"
              />
              <button
                type="button"
                class="remove"
                [disabled]="busy()"
                [attr.aria-label]="'Remove photo ' + (idx + 1) + ' of ' + placeName()"
                (click)="imageRemoved.emit(name)"
              >
                Remove
              </button>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    .photos {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }
    .picker {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--font-size-small);
      color: var(--color-text);
    }
    .error {
      margin: 0;
      font-size: var(--font-size-small);
      color: var(--color-text);
      padding: var(--space-2);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      background: var(--color-surface);
    }
    .grid {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
    .item {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      padding: var(--space-1);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      background: var(--color-surface);
    }
    .thumb {
      display: block;
      object-fit: cover;
      border-radius: var(--radius);
    }
    .remove {
      padding: var(--space-1) var(--space-2);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      background: var(--color-surface);
      color: var(--color-text);
      font: inherit;
      font-size: var(--font-size-small);
      cursor: pointer;
    }
  `,
})
export class PlaceImages {
  readonly placeId = input.required<string>();
  readonly placeName = input.required<string>();
  readonly images = input<readonly string[]>([]);
  readonly busy = input(false);
  readonly error = input<string>('');
  readonly filesChosen = output<File[]>();
  readonly imageRemoved = output<string>();

  protected imageSrc(name: string): string {
    return `/api/places/${encodeURIComponent(this.placeId())}/images/${encodeURIComponent(name)}`;
  }

  protected onFileChange(event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const files = inputEl.files ? Array.from(inputEl.files) : [];
    if (files.length > 0) {
      this.filesChosen.emit(files);
    }
  }
}
