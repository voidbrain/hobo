import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PlacesApi } from '../../data/places-api';
import type { Place } from '../../core/place';
import { PlacesPage } from './places-page';

const place: Place = {
  id: 'place-1',
  name: 'Rocca Calascio',
  description: '',
  images: [],
  category: null,
  tags: [],
  notes: '',
  location: null,
  timeSpent: null,
  createdAt: '2026-11-27T10:00:00.000Z',
  updatedAt: '2026-11-27T10:00:00.000Z',
};

describe('PlacesPage', () => {
  const api = {
    list: vi.fn(() => of([place])),
    create: vi.fn(() => of(place)),
    update: vi.fn(() => of(place)),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [PlacesPage],
      providers: [{ provide: PlacesApi, useValue: api }],
    });
  });

  it('lists saved places and opens the add form', async () => {
    const fixture = TestBed.createComponent(PlacesPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('Rocca Calascio');
    root.querySelector<HTMLButtonElement>('button')?.click();
    await fixture.whenStable();

    expect(root.querySelector('form')).not.toBeNull();
    expect(root.querySelector<HTMLInputElement>('#place-name')?.value).toBe('');
  });

  it('creates a place from its name and optional details', async () => {
    const fixture = TestBed.createComponent(PlacesPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('button')?.click();
    await fixture.whenStable();

    const name = root.querySelector<HTMLInputElement>('#place-name')!;
    name.value = 'Lake Braies';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    root
      .querySelector<HTMLFormElement>('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(api.create).toHaveBeenCalledWith({
      name: 'Lake Braies',
      description: '',
      category: null,
      tags: [],
      notes: '',
      timeSpent: null,
    });
  });

  it('requires a name before saving', async () => {
    const fixture = TestBed.createComponent(PlacesPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('button')?.click();
    await fixture.whenStable();
    root
      .querySelector<HTMLFormElement>('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(api.create).not.toHaveBeenCalled();
    expect(root.textContent).toContain('A name is required.');
  });

  it('updates an existing place from the edit form', async () => {
    const updated = { ...place, description: 'A mountain fortress' };
    api.update.mockReturnValueOnce(of(updated));
    const fixture = TestBed.createComponent(PlacesPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('.place-list button')?.click();
    await fixture.whenStable();

    const description = root.querySelector<HTMLTextAreaElement>('#place-description')!;
    description.value = 'A mountain fortress';
    description.dispatchEvent(new Event('input', { bubbles: true }));
    root
      .querySelector<HTMLFormElement>('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(api.update).toHaveBeenCalledWith(
      'place-1',
      expect.objectContaining({ description: 'A mountain fortress' }),
    );
    expect(root.textContent).toContain('A mountain fortress');
  });

  it('closes the form when editing is cancelled', async () => {
    const fixture = TestBed.createComponent(PlacesPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('button')?.click();
    await fixture.whenStable();
    root.querySelector<HTMLButtonElement>('form button.secondary')?.click();
    await fixture.whenStable();

    expect(root.querySelector('form')).toBeNull();
  });

  it('reports a failed place load', async () => {
    api.list.mockReturnValueOnce(throwError(() => new Error('offline')));
    const fixture = TestBed.createComponent(PlacesPage);
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Could not load places. Try again.',
    );
  });

  it('reports a failed save', async () => {
    api.create.mockReturnValueOnce(throwError(() => new Error('offline')));
    const fixture = TestBed.createComponent(PlacesPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('button')?.click();
    await fixture.whenStable();
    const name = root.querySelector<HTMLInputElement>('#place-name')!;
    name.value = 'Lake Braies';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    root
      .querySelector<HTMLFormElement>('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(root.textContent).toContain('Could not save the place. Try again.');
  });
});
