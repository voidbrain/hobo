import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { afterEach } from 'vitest';
import autocompleteFixture from '../../../../server/fixtures/ors/geocode-autocomplete.json';
import { PlacesApi } from '../../data/places-api';
import type { Place } from '../../core/place';
import type { GeocodeCandidate, MapPoint } from '../../maps/map-provider';
import { MapsApi, MapsApiError } from '../../maps/maps-api';
import { MapView } from '../../maps/map-view';
import { PlacesPage } from './places-page';

const pickedPoint: MapPoint = { lat: 45.2, lng: 9.3 };
const candidate: GeocodeCandidate = {
  label: 'Lake Braies, Inventedland',
  location: pickedPoint,
  country: 'Inventedland',
  region: null,
  locality: 'Lake Braies',
};

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
    remove: vi.fn(() => of(undefined)),
    reassignTaxonomy: vi.fn(() => of([] as Place[])),
  };

  afterEach(() => vi.restoreAllMocks());

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [PlacesPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PlacesApi, useValue: api },
      ],
    });
  });

  it('lists saved places and opens the add form', async () => {
    const fixture = TestBed.createComponent(PlacesPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('Rocca Calascio');
    root.querySelector<HTMLButtonElement>('button')?.click();
    await fixture.whenStable();

    expect(root.querySelector('#place-form')).not.toBeNull();
    expect(root.querySelector<HTMLInputElement>('#place-name')?.value).toBe('');
  });

  it('filters by category and tag, and groups the visible places by tag', async () => {
    const places: Place[] = [
      {
        ...place,
        id: 'place-outdoors',
        name: 'Harbour',
        category: 'Outdoors',
        tags: ['water', 'family'],
      },
      { ...place, id: 'place-culture', name: 'Museum', category: 'Culture', tags: ['family'] },
      { ...place, id: 'place-unassigned', name: 'Picnic', category: null, tags: [] },
    ];
    api.list.mockReturnValueOnce(of(places));
    const fixture = TestBed.createComponent(PlacesPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const category = root.querySelector<HTMLSelectElement>('#filter-category')!;
    category.value = 'Outdoors';
    category.dispatchEvent(new Event('change', { bubbles: true }));
    const tag = root.querySelector<HTMLSelectElement>('#filter-tag')!;
    tag.value = 'family';
    tag.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();

    expect(root.querySelectorAll('.place-list li h2')).toHaveLength(1);
    expect(root.querySelector('.place-list li h2')?.textContent).toContain('Harbour');

    category.value = '';
    category.dispatchEvent(new Event('change', { bubbles: true }));
    tag.value = '';
    tag.dispatchEvent(new Event('change', { bubbles: true }));
    const groupBy = root.querySelector<HTMLSelectElement>('#group-places')!;
    groupBy.value = 'tag';
    groupBy.dispatchEvent(new Event('change', { bubbles: true }));
    fixture.detectChanges();

    expect(
      [...root.querySelectorAll('.place-group h3')].map((heading) => heading.textContent?.trim()),
    ).toEqual(['family', 'No tags', 'water']);
  });

  it('renames a category across its places and announces the result', async () => {
    const places: Place[] = [
      { ...place, id: 'place-one', name: 'Harbour', category: 'Outdoors' },
      { ...place, id: 'place-two', name: 'Shore', category: 'Outdoors' },
    ];
    const renamed = places.map((item) => ({ ...item, category: 'Nature' }));
    api.list.mockReturnValueOnce(of(places));
    api.reassignTaxonomy.mockReturnValueOnce(of(renamed));
    const fixture = TestBed.createComponent(PlacesPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    const kind = root.querySelector<HTMLSelectElement>('#taxonomy-kind')!;
    kind.value = 'category';
    kind.dispatchEvent(new Event('change', { bubbles: true }));
    const source = root.querySelector<HTMLSelectElement>('#taxonomy-source')!;
    source.value = 'Outdoors';
    source.dispatchEvent(new Event('change', { bubbles: true }));
    const action = root.querySelector<HTMLSelectElement>('#taxonomy-action')!;
    action.value = 'rename';
    action.dispatchEvent(new Event('change', { bubbles: true }));
    const target = root.querySelector<HTMLInputElement>('#taxonomy-target-name')!;
    target.value = 'Nature';
    target.dispatchEvent(new Event('input', { bubbles: true }));
    root.querySelector<HTMLFormElement>('#taxonomy-form')!.requestSubmit();
    await fixture.whenStable();

    expect(api.reassignTaxonomy).toHaveBeenCalledWith('category', 'Outdoors', 'Nature');
    expect(root.textContent).toContain('Updated 2 places.');
    expect(root.textContent).toContain('Nature');
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
      .querySelector<HTMLFormElement>('#place-form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(api.create).toHaveBeenCalledWith({
      name: 'Lake Braies',
      description: '',
      category: null,
      tags: [],
      notes: '',
      timeSpent: null,
      location: null,
    });
  });

  it('requires a name before saving', async () => {
    const fixture = TestBed.createComponent(PlacesPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('button')?.click();
    await fixture.whenStable();
    root
      .querySelector<HTMLFormElement>('#place-form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(api.create).not.toHaveBeenCalled();
    const name = root.querySelector<HTMLInputElement>('#place-name')!;
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(name.getAttribute('aria-describedby')).toContain('name-error');
    const error = root.querySelector('#name-error[role="alert"]');
    expect(error?.textContent).toContain('A name is required.');
    expect(error?.querySelector('[aria-hidden="true"]')?.textContent).toBe('!');
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
      .querySelector<HTMLFormElement>('#place-form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(api.update).toHaveBeenCalledWith(
      'place-1',
      expect.objectContaining({ description: 'A mountain fortress' }),
    );
    expect(root.textContent).toContain('A mountain fortress');
  });

  it('shows an existing location on the edit map and displays its coordinates', async () => {
    api.list.mockReturnValueOnce(of([{ ...place, location: pickedPoint }]));
    const fixture = TestBed.createComponent(PlacesPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('.place-list button')?.click();
    await fixture.whenStable();

    expect(root.textContent).toContain('Selected coordinates: 45.20000, 9.30000');
    const map = fixture.debugElement.query(By.directive(MapView)).componentInstance as MapView;
    expect(map.markers()).toEqual([{ location: pickedPoint, label: place.name }]);
  });

  it('clears a saved location by sending null when the edited place is saved', async () => {
    api.list.mockReturnValueOnce(of([{ ...place, location: pickedPoint }]));
    const fixture = TestBed.createComponent(PlacesPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('.place-list button')?.click();
    await fixture.whenStable();
    root.querySelector<HTMLButtonElement>('button.secondary')!.click();
    const name = root.querySelector<HTMLInputElement>('#place-name')!;
    name.value = 'Rocca Calascio';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    root
      .querySelector<HTMLFormElement>('#place-form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(api.update).toHaveBeenCalledWith('place-1', expect.objectContaining({ location: null }));
  });

  it('closes the form when editing is cancelled', async () => {
    const fixture = TestBed.createComponent(PlacesPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('button')?.click();
    await fixture.whenStable();
    root.querySelector<HTMLButtonElement>('#place-form button.secondary')?.click();
    await fixture.whenStable();

    expect(root.querySelector('#place-form')).toBeNull();
  });

  it('confirms deletion from the place list, announces success, and returns focus to the page', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fixture = TestBed.createComponent(PlacesPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    root.querySelector<HTMLButtonElement>('.delete-place')?.click();
    await fixture.whenStable();

    expect(confirm).toHaveBeenCalledWith('Delete "Rocca Calascio"? This cannot be undone.');
    expect(api.remove).toHaveBeenCalledWith('place-1');
    expect(root.querySelector('.place-list')).toBeNull();
    expect(root.querySelector('[role="status"]')?.textContent).toContain(
      'Rocca Calascio was deleted.',
    );
    expect(document.activeElement).toBe(root.querySelector('#places-title'));
  });

  it('confirms deletion from the edit form', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fixture = TestBed.createComponent(PlacesPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('.place-list .edit-place')?.click();
    await fixture.whenStable();

    root.querySelector<HTMLButtonElement>('#delete-place')?.click();
    await fixture.whenStable();

    expect(api.remove).toHaveBeenCalledWith('place-1');
    expect(root.querySelector('#place-form')).toBeNull();
    expect(root.textContent).toContain('Rocca Calascio was deleted.');
  });

  it('announces all trip names when the service refuses a deletion', async () => {
    api.remove.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: {
              errors: [
                'Cannot delete Rocca Calascio because it is used in trips: Ridge Weekend, Bay Trail.',
              ],
            },
          }),
      ),
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fixture = TestBed.createComponent(PlacesPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    root.querySelector<HTMLButtonElement>('.delete-place')?.click();
    await fixture.whenStable();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain('Ridge Weekend, Bay Trail');
    expect(root.querySelector('.place-list')).not.toBeNull();
  });

  it('connects confirmed deletion to PlacesApi and announces a service refusal', async () => {
    TestBed.overrideProvider(PlacesApi, { useFactory: () => new PlacesApi() });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const fixture = TestBed.createComponent(PlacesPage);
    const root = fixture.nativeElement as HTMLElement;
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/places').flush([place]);
    await fixture.whenStable();

    root.querySelector<HTMLButtonElement>('.delete-place')?.click();
    await fixture.whenStable();

    expect(confirm).toHaveBeenCalled();
    const request = http.expectOne('/api/places/place-1');
    expect(request.request.method).toBe('DELETE');
    request.flush(
      { errors: ['Cannot delete Rocca Calascio because it is used in trips: Ridge Weekend.'] },
      { status: 409, statusText: 'Conflict' },
    );
    await Promise.resolve();
    await fixture.whenStable();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain('Ridge Weekend');
    expect(root.querySelector('.place-list')).not.toBeNull();
    http.verify();
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
      .querySelector<HTMLFormElement>('#place-form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(root.textContent).toContain('Could not save the place. Try again.');
  });

  it('searches autocomplete suggestions, shows the location, and saves it', async () => {
    vi.spyOn(TestBed.inject(MapsApi), 'autocomplete').mockReturnValue(of([candidate]));
    const fixture = TestBed.createComponent(PlacesPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('button')?.click();
    await fixture.whenStable();

    const search = root.querySelector<HTMLInputElement>('#location-search')!;
    search.value = 'Lake Braies';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 300));
    await fixture.whenStable();

    expect(TestBed.inject(MapsApi).autocomplete).toHaveBeenCalledWith('Lake Braies', 5);
    const suggestion = root.querySelector<HTMLButtonElement>('.location-suggestions button')!;
    suggestion.focus();
    suggestion.click();
    await fixture.whenStable();
    expect(document.activeElement).toBe(root.querySelector('#location-search'));
    expect(root.querySelector('#location-summary')?.textContent).toContain(
      'Selected coordinates: 45.20000, 9.30000',
    );
    const map = fixture.debugElement.query(By.directive(MapView)).componentInstance as MapView;
    expect(map.markers()).toEqual([{ location: pickedPoint, label: 'Lake Braies, Inventedland' }]);

    const name = root.querySelector<HTMLInputElement>('#place-name')!;
    name.value = 'Lake Braies';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    root
      .querySelector<HTMLFormElement>('#place-form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ location: pickedPoint }));
  });

  it('uses a map pick as the saved place location', async () => {
    const fixture = TestBed.createComponent(PlacesPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('button')?.click();
    await fixture.whenStable();
    const map = fixture.debugElement.query(By.directive(MapView)).componentInstance as MapView;
    map.picked.emit(pickedPoint);
    await fixture.whenStable();

    const name = root.querySelector<HTMLInputElement>('#place-name')!;
    name.value = 'Map picked place';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    root
      .querySelector<HTMLFormElement>('#place-form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ location: pickedPoint }));
  });

  it('connects location search to the local autocomplete endpoint', async () => {
    const fixture = TestBed.createComponent(PlacesPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('button')?.click();
    await fixture.whenStable();

    const search = root.querySelector<HTMLInputElement>('#location-search')!;
    search.value = 'Lake Braies';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 300));
    const http = TestBed.inject(HttpTestingController);
    const request = http.expectOne(
      (req) =>
        req.url === '/api/maps/autocomplete' &&
        req.params.get('q') === 'Lake Braies' &&
        req.params.get('limit') === '5',
    );
    const feature = autocompleteFixture.features[0]!;
    const [lng, lat] = feature.geometry.coordinates;
    request.flush([
      {
        label: feature.properties.label,
        location: { lat, lng },
        country: feature.properties.country,
        region: null,
        locality: feature.properties.locality,
      },
    ]);
    await fixture.whenStable();

    expect(root.textContent).toContain('Harbour Quay, Portwind');
    http.verify();
  });

  it('shows a message when search returns no places', async () => {
    vi.spyOn(TestBed.inject(MapsApi), 'autocomplete').mockReturnValue(of([]));
    const fixture = TestBed.createComponent(PlacesPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('button')?.click();
    await fixture.whenStable();
    const search = root.querySelector<HTMLInputElement>('#location-search')!;
    search.value = 'Unknown Place';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 300));
    await fixture.whenStable();

    expect(root.textContent).toContain('No places found.');
  });

  it('shows the autocomplete error when a search fails', async () => {
    vi.spyOn(TestBed.inject(MapsApi), 'autocomplete').mockReturnValue(
      throwError(() => new Error('offline')),
    );
    const fixture = TestBed.createComponent(PlacesPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('button')?.click();
    await fixture.whenStable();
    const search = root.querySelector<HTMLInputElement>('#location-search')!;
    search.value = 'Unknown Place';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 300));
    await fixture.whenStable();

    expect(root.textContent).toContain(
      'Could not search for places. Check map settings and try again.',
    );
  });

  it('explains how to configure OpenRouteService when its key is missing', async () => {
    vi.spyOn(TestBed.inject(MapsApi), 'autocomplete').mockReturnValue(
      throwError(
        () =>
          new MapsApiError(503, 'missing_key', [
            'OpenRouteService API key is not configured. Add openRouteServiceApiKey to server/config.local.json.',
          ]),
      ),
    );
    const fixture = TestBed.createComponent(PlacesPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('button')?.click();
    await fixture.whenStable();
    const search = root.querySelector<HTMLInputElement>('#location-search')!;
    search.value = 'Treviso';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 300));
    await fixture.whenStable();

    expect(root.textContent).toContain(
      'Place search needs an OpenRouteService key. Add openRouteServiceApiKey to server/config.local.json; see README for setup.',
    );
  });

  it('does not request autocomplete for a query shorter than three characters', async () => {
    const autocomplete = vi.spyOn(TestBed.inject(MapsApi), 'autocomplete');
    const fixture = TestBed.createComponent(PlacesPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('button')?.click();
    await fixture.whenStable();
    const search = root.querySelector<HTMLInputElement>('#location-search')!;
    search.value = 'ab';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(autocomplete).not.toHaveBeenCalled();
  });
});
