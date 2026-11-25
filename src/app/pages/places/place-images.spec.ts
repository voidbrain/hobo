import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PlaceImages } from './place-images';

@Component({
  imports: [PlaceImages],
  template: `
    <hobo-place-images
      placeId="p-1"
      placeName="Lantern Hill"
      [images]="images()"
      [error]="error()"
      (filesChosen)="chosen.set($event)"
      (imageRemoved)="removed.set($event)"
    />
  `,
})
class Host {
  readonly images = signal<readonly string[]>(['11111111-1111-1111-1111-111111111111.jpg']);
  readonly error = signal('');
  readonly chosen = signal<File[]>([]);
  readonly removed = signal('');
}

describe('PlaceImages (F-002-T03)', () => {
  it('renders thumbnails with accessible alt text and emits chosen and removed files', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    const img: HTMLImageElement | null = fixture.nativeElement.querySelector('img.thumb');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe(
      '/api/places/p-1/images/11111111-1111-1111-1111-111111111111.jpg',
    );
    expect(img?.getAttribute('alt')).toBe('Lantern Hill photo 1');

    const removeBtn: HTMLButtonElement | null =
      fixture.nativeElement.querySelector('button.remove');
    expect(removeBtn?.getAttribute('aria-label')).toBe('Remove photo 1 of Lantern Hill');
    removeBtn?.click();
    expect(fixture.componentInstance.removed()).toBe('11111111-1111-1111-1111-111111111111.jpg');

    const fileInput: HTMLInputElement = fixture.nativeElement.querySelector('input[type="file"]');
    const sample = new File([new Uint8Array([1, 2, 3])], 'invented.png', { type: 'image/png' });
    Object.defineProperty(fileInput, 'files', { value: [sample] });
    fileInput.dispatchEvent(new Event('change'));
    expect(fixture.componentInstance.chosen()).toEqual([sample]);

    fixture.componentInstance.error.set('Unsupported image format.');
    await fixture.whenStable();
    const alert: HTMLElement | null = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert?.textContent?.trim()).toBe('Unsupported image format.');
  });

  it('handles empty images list and cancelled/empty file selection cleanly', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.images.set([]);
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelectorAll('img.thumb').length).toBe(0);

    const fileInput: HTMLInputElement = fixture.nativeElement.querySelector('input[type="file"]');
    Object.defineProperty(fileInput, 'files', { value: [] });
    fileInput.dispatchEvent(new Event('change'));
    expect(fixture.componentInstance.chosen()).toEqual([]);
  });
});
