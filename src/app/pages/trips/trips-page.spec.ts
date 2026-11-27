import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PlacesApi } from '../../data/places-api';
import { TripsApi } from '../../data/trips-api';
import type { Place } from '../../core/place';
import type { HoboSettings, Trip, TripEndpoint } from '../../core/trip';
import { TripsPage } from './trips-page';

const home: TripEndpoint = {
  name: 'Harbour Base',
  location: { lat: 45.4, lng: 12.3 },
  placeId: null,
};

const harbour: Place = {
  id: 'place-harbour',
  name: 'Harbour',
  description: '',
  images: [],
  category: 'Coast',
  tags: ['water'],
  notes: '',
  location: { lat: 45.5, lng: 12.4 },
  timeSpent: null,
  createdAt: '2026-11-27T10:00:00.000Z',
  updatedAt: '2026-11-27T10:00:00.000Z',
};

const ridge: Place = {
  ...harbour,
  id: 'place-ridge',
  name: 'Ridge View',
  category: 'Outdoors',
  tags: ['water', 'viewpoint'],
  location: null,
};

const savedTrip: Trip = {
  id: 'trip-1',
  name: 'Coast Loop',
  startDate: '2026-12-02',
  endDate: '2026-12-03',
  from: home,
  to: home,
  days: [
    { date: '2026-12-02', stops: ['place-ridge'] },
    { date: '2026-12-03', stops: [] },
  ],
  createdAt: '2026-11-27T10:00:00.000Z',
  updatedAt: '2026-11-27T10:00:00.000Z',
};

const setInput = (root: HTMLElement, id: string, value: string) => {
  const input = root.querySelector<HTMLInputElement>(`#${id}`)!;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

const setSelect = (root: HTMLElement, id: string, value: string) => {
  const select = root.querySelector<HTMLSelectElement>(`#${id}`)!;
  select.value = value;
  select.dispatchEvent(new Event('input', { bubbles: true }));
  select.dispatchEvent(new Event('change', { bubbles: true }));
};

const submit = (root: HTMLElement) =>
  root
    .querySelector<HTMLFormElement>('#trip-form')!
    .dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }));

const nextTurn = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('TripsPage', () => {
  const tripsApi = {
    list: vi.fn(() => of([] as Trip[])),
    getSettings: vi.fn(() => of({ home } as HoboSettings)),
    create: vi.fn(() => of(savedTrip)),
    update: vi.fn(() => of(savedTrip)),
  };
  const placesApi = {
    list: vi.fn(() => of([harbour, ridge])),
    create: vi.fn(() => of(ridge)),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    tripsApi.list.mockReturnValue(of([]));
    tripsApi.getSettings.mockReturnValue(of({ home }));
    placesApi.list.mockReturnValue(of([harbour, ridge]));
    TestBed.configureTestingModule({
      imports: [TripsPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TripsApi, useValue: tripsApi },
        { provide: PlacesApi, useValue: placesApi },
      ],
    });
  });

  it('filters places by search, category and tag, then saves the selected stop and endpoints', async () => {
    const fixture = TestBed.createComponent(TripsPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('#add-trip')?.click();
    await fixture.whenStable();

    setInput(root, 'trip-name', 'Coast Loop');
    setInput(root, 'trip-start', '2026-12-02');
    setInput(root, 'trip-end', '2026-12-03');
    setSelect(root, 'from-choice', 'place:place-harbour');
    setSelect(root, 'to-choice', 'custom');
    await fixture.whenStable();
    expect(root.querySelector('#to-custom-name')).not.toBeNull();
    setInput(root, 'to-custom-name', 'Ridge Trailhead');
    setInput(root, 'stop-search', 'ridge');
    setSelect(root, 'stop-category', 'Outdoors');
    setSelect(root, 'stop-tag', 'viewpoint');
    await fixture.whenStable();

    expect(root.querySelectorAll('#place-candidates li')).toHaveLength(1);
    expect(root.querySelector('#place-candidates')?.textContent).toContain('Ridge View');
    setSelect(root, 'stop-date', '2026-12-03');
    root.querySelector<HTMLButtonElement>('#place-candidates button')?.click();
    await fixture.whenStable();
    submit(root);
    await nextTurn();
    await fixture.whenStable();

    expect(tripsApi.create).toHaveBeenCalledWith({
      name: 'Coast Loop',
      startDate: '2026-12-02',
      endDate: '2026-12-03',
      from: { name: 'Harbour', location: harbour.location, placeId: harbour.id },
      to: { name: 'Ridge Trailhead', location: null, placeId: null },
      days: [
        { date: '2026-12-02', stops: [] },
        { date: '2026-12-03', stops: [ridge.id] },
      ],
    });
  });

  it('creates a place from the editor and adds it as a stop', async () => {
    const newPlace = { ...ridge, id: 'place-new', name: 'New Lookout' };
    placesApi.create.mockReturnValueOnce(of(newPlace));
    const fixture = TestBed.createComponent(TripsPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('#add-trip')?.click();
    await fixture.whenStable();
    setInput(root, 'trip-name', 'Lookout Day');
    setInput(root, 'trip-start', '2026-12-02');
    setInput(root, 'trip-end', '2026-12-02');
    setInput(root, 'new-place-name', 'New Lookout');
    await fixture.whenStable();
    root.querySelector<HTMLButtonElement>('#create-and-add-place')?.click();
    await fixture.whenStable();

    expect(placesApi.create).toHaveBeenCalledWith({ name: 'New Lookout' });
    expect(root.querySelector('#trip-days')?.textContent).toContain('New Lookout');
    expect(root.querySelector('[role="status"]')?.textContent).toContain(
      'New Lookout was added to the trip.',
    );
  });

  it('edits a saved trip and updates it through TripsApi', async () => {
    const otherTrip = { ...savedTrip, id: 'trip-2', name: 'Other trip' };
    tripsApi.list.mockReturnValueOnce(of([otherTrip, savedTrip]));
    const updated = { ...savedTrip, name: 'Coast Loop Extended' };
    tripsApi.update.mockReturnValueOnce(of(updated));
    const fixture = TestBed.createComponent(TripsPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelectorAll<HTMLButtonElement>('.edit-trip')[1].click();
    await fixture.whenStable();
    setInput(root, 'trip-name', 'Coast Loop Extended');
    submit(root);
    await nextTurn();
    await fixture.whenStable();

    expect(tripsApi.update).toHaveBeenCalledWith(
      'trip-1',
      expect.objectContaining({ name: 'Coast Loop Extended', days: savedTrip.days }),
    );
    expect(root.querySelector('[role="status"]')?.textContent).toContain('Trip saved.');
    expect(root.textContent).toContain('Other trip');
    expect(root.textContent).toContain('Coast Loop Extended');
  });

  it('reports a load failure without hiding the Trips page', async () => {
    tripsApi.list.mockReturnValueOnce(throwError(() => new Error('offline')));
    const fixture = TestBed.createComponent(TripsPage);
    await fixture.whenStable();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent,
    ).toContain('Could not load trips and places. Try again.');
  });

  it('reports place creation failures and keeps the editor available', async () => {
    placesApi.create.mockReturnValueOnce(throwError(() => new Error('offline')));
    const fixture = TestBed.createComponent(TripsPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('#add-trip')?.click();
    await fixture.whenStable();
    setInput(root, 'trip-start', '2026-12-02');
    setInput(root, 'trip-end', '2026-12-02');
    setInput(root, 'new-place-name', 'Offline Lookout');
    await fixture.whenStable();
    root.querySelector<HTMLButtonElement>('#create-and-add-place')?.click();
    await nextTurn();
    await fixture.whenStable();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'Could not create the place. Try again.',
    );
    expect(root.querySelector('#trip-form')).not.toBeNull();
  });

  it('disables place creation without a name or an active day', async () => {
    const fixture = TestBed.createComponent(TripsPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('#add-trip')?.click();
    await fixture.whenStable();
    const createButton = root.querySelector<HTMLButtonElement>('#create-and-add-place')!;
    expect(createButton.disabled).toBe(true);
    setInput(root, 'new-place-name', 'No date place');
    await fixture.whenStable();
    expect(createButton.disabled).toBe(true);

    expect(placesApi.create).not.toHaveBeenCalled();
  });

  it('shows API validation errors when saving fails', async () => {
    tripsApi.create.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { errors: ['The trip dates are invalid'] },
          }),
      ),
    );
    const fixture = TestBed.createComponent(TripsPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('#add-trip')?.click();
    await fixture.whenStable();
    setInput(root, 'trip-name', 'Invalid dates');
    setInput(root, 'trip-start', '2026-12-03');
    setInput(root, 'trip-end', '2026-12-02');
    submit(root);
    await nextTurn();
    await fixture.whenStable();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'The trip dates are invalid',
    );
    expect(root.querySelector('#trip-form')).not.toBeNull();
  });

  it('removes a stop from its day', async () => {
    tripsApi.list.mockReturnValueOnce(of([savedTrip]));
    const fixture = TestBed.createComponent(TripsPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('.edit-trip')?.click();
    await fixture.whenStable();
    const removeButton = [...root.querySelectorAll<HTMLButtonElement>('#trip-days button')].find(
      (button) => button.textContent?.includes('Remove Ridge View'),
    );
    expect(removeButton).toBeDefined();
    removeButton?.click();
    await fixture.whenStable();

    expect(root.querySelector('#trip-days')?.textContent).not.toContain('Remove Ridge View');
    expect(root.querySelector('#trip-days')?.textContent).toContain('No stops for this day.');
  });

  it('edits trips with no endpoints and can clear both endpoint choices', async () => {
    const trip = { ...savedTrip, from: null, to: null };
    tripsApi.list.mockReturnValueOnce(of([trip]));
    tripsApi.update.mockReturnValueOnce(of(trip));
    const fixture = TestBed.createComponent(TripsPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('.edit-trip')?.click();
    await fixture.whenStable();
    expect(root.querySelector<HTMLSelectElement>('#from-choice')?.value).toBe('none');
    expect(root.querySelector<HTMLSelectElement>('#to-choice')?.value).toBe('none');
    setSelect(root, 'from-choice', 'none');
    setSelect(root, 'to-choice', 'none');
    submit(root);
    await nextTurn();
    await fixture.whenStable();

    expect(tripsApi.update).toHaveBeenCalledWith(
      trip.id,
      expect.objectContaining({ from: null, to: null }),
    );
  });

  it('edits a trip whose endpoint is a saved place', async () => {
    const trip = {
      ...savedTrip,
      from: { name: harbour.name, location: harbour.location, placeId: harbour.id },
      to: null,
    };
    tripsApi.list.mockReturnValueOnce(of([trip]));
    const fixture = TestBed.createComponent(TripsPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('.edit-trip')?.click();
    await fixture.whenStable();

    expect(root.querySelector<HTMLSelectElement>('#from-choice')?.value).toBe(
      `place:${harbour.id}`,
    );
    expect(root.querySelector<HTMLSelectElement>('#to-choice')?.value).toBe('none');
  });

  it('keeps an invalid new trip open and reports required fields', async () => {
    const fixture = TestBed.createComponent(TripsPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('#add-trip')?.click();
    await fixture.whenStable();
    submit(root);
    await fixture.whenStable();

    expect(tripsApi.create).not.toHaveBeenCalled();
    expect(root.querySelector('#trip-form')).not.toBeNull();
    expect(root.querySelector('#trip-name-error')?.textContent).toContain(
      'A trip name is required.',
    );
    expect(root.querySelector('#trip-start-error')?.textContent).toContain(
      'A start date is required.',
    );
    expect(root.querySelector('#trip-end-error')?.textContent).toContain(
      'An end date is required.',
    );
  });

  it('creates a trip with null endpoints when no home place is configured', async () => {
    tripsApi.getSettings.mockReturnValueOnce(of({ home: null }));
    const fixture = TestBed.createComponent(TripsPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('#add-trip')?.click();
    await fixture.whenStable();
    setInput(root, 'trip-name', 'No home trip');
    setInput(root, 'trip-start', '2026-12-02');
    setInput(root, 'trip-end', '2026-12-02');
    submit(root);
    await nextTurn();
    await fixture.whenStable();

    expect(tripsApi.create).toHaveBeenCalledWith(expect.objectContaining({ from: null, to: null }));
  });

  it('edits custom endpoints when no home place is configured', async () => {
    tripsApi.getSettings.mockReturnValueOnce(of({ home: null }));
    const trip = {
      ...savedTrip,
      from: { name: 'Trailhead', location: null, placeId: null },
      to: null,
    };
    tripsApi.list.mockReturnValueOnce(of([trip]));
    const fixture = TestBed.createComponent(TripsPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('.edit-trip')?.click();
    await fixture.whenStable();

    expect(root.querySelector<HTMLSelectElement>('#from-choice')?.value).toBe('custom');
    expect(root.querySelector<HTMLInputElement>('#from-custom-name')?.value).toBe('Trailhead');
    expect(root.querySelector<HTMLSelectElement>('#to-choice')?.value).toBe('none');
  });

  it('cancels trip editing and returns to the saved trips', async () => {
    tripsApi.list.mockReturnValueOnce(of([savedTrip]));
    const fixture = TestBed.createComponent(TripsPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('.edit-trip')?.click();
    await fixture.whenStable();
    root.querySelector<HTMLButtonElement>('.form-actions button[type="button"]')?.click();
    await fixture.whenStable();

    expect(root.querySelector('#trip-form')).toBeNull();
    expect(root.textContent).toContain('Coast Loop');
  });

  it('edits an endpoint that no longer matches a saved place as a custom endpoint', async () => {
    const trip = {
      ...savedTrip,
      from: { name: 'Harbour Base', location: { lat: 45.4, lng: 13.2 }, placeId: null },
      to: { name: 'Old Summit', location: null, placeId: null },
    };
    tripsApi.list.mockReturnValueOnce(of([trip]));
    const fixture = TestBed.createComponent(TripsPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('.edit-trip')?.click();
    await fixture.whenStable();

    expect(root.querySelector<HTMLSelectElement>('#from-choice')?.value).toBe('custom');
    expect(root.querySelector<HTMLInputElement>('#from-custom-name')?.value).toBe('Harbour Base');
    expect(root.querySelector<HTMLSelectElement>('#to-choice')?.value).toBe('custom');
    expect(root.querySelector<HTMLInputElement>('#to-custom-name')?.value).toBe('Old Summit');
  });

  it('falls back to a general message for non-HTTP save errors', async () => {
    tripsApi.create.mockReturnValueOnce(throwError(() => new Error('offline')));
    const fixture = TestBed.createComponent(TripsPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('#add-trip')?.click();
    await fixture.whenStable();
    setInput(root, 'trip-name', 'Offline trip');
    setInput(root, 'trip-start', '2026-12-02');
    setInput(root, 'trip-end', '2026-12-02');
    submit(root);
    await nextTurn();
    await fixture.whenStable();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'Could not save the trip. Check its details and try again.',
    );
  });

  it('shows an unknown stop label when a referenced place is unavailable', async () => {
    const trip = { ...savedTrip, days: [{ date: savedTrip.startDate, stops: ['missing-place'] }] };
    tripsApi.list.mockReturnValueOnce(of([trip]));
    const fixture = TestBed.createComponent(TripsPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('.edit-trip')?.click();
    await fixture.whenStable();

    expect(root.querySelector('#trip-days')?.textContent).toContain('Unknown place');
  });

  it('announces when filters have no place matches', async () => {
    const fixture = TestBed.createComponent(TripsPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('#add-trip')?.click();
    await fixture.whenStable();
    setInput(root, 'stop-search', 'not a saved place');
    await fixture.whenStable();

    expect(root.textContent).toContain('No places match these filters.');
  });

  it('does not add a stop when the date range has no days', async () => {
    const fixture = TestBed.createComponent(TripsPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('#add-trip')?.click();
    await fixture.whenStable();
    root.querySelector<HTMLInputElement>('#trip-start')!.value = '';
    root
      .querySelector<HTMLInputElement>('#trip-start')!
      .dispatchEvent(new Event('input', { bubbles: true }));
    root.querySelector<HTMLInputElement>('#trip-end')!.value = '';
    root
      .querySelector<HTMLInputElement>('#trip-end')!
      .dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    root.querySelector<HTMLButtonElement>('#place-candidates button')?.click();
    await fixture.whenStable();

    expect(root.querySelector('#trip-days')?.textContent).toBe('');
    expect(root.querySelector('[role="status"]')).toBeNull();
  });

  it('falls back to the first day when the selected stop date leaves the trip range', async () => {
    const fixture = TestBed.createComponent(TripsPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('#add-trip')?.click();
    await fixture.whenStable();
    setInput(root, 'trip-start', '2026-12-02');
    setInput(root, 'trip-end', '2026-12-03');
    await fixture.whenStable();
    setSelect(root, 'stop-date', '2026-12-03');
    setInput(root, 'trip-end', '2026-12-02');
    await fixture.whenStable();

    expect(root.querySelector<HTMLSelectElement>('#stop-date')?.value).toBe('2026-12-02');
  });

  it('uses the general save message for malformed API error details', async () => {
    tripsApi.create.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { errors: ['Valid error', 42] },
          }),
      ),
    );
    const fixture = TestBed.createComponent(TripsPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('#add-trip')?.click();
    await fixture.whenStable();
    setInput(root, 'trip-name', 'Malformed API error');
    setInput(root, 'trip-start', '2026-12-02');
    setInput(root, 'trip-end', '2026-12-02');
    submit(root);
    await nextTurn();
    await fixture.whenStable();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'Could not save the trip. Check its details and try again.',
    );
  });

  it('uses the general save message when an HTTP error has no body', async () => {
    tripsApi.create.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 503, error: null })),
    );
    const fixture = TestBed.createComponent(TripsPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('#add-trip')?.click();
    await fixture.whenStable();
    setInput(root, 'trip-name', 'Unavailable service');
    setInput(root, 'trip-start', '2026-12-02');
    setInput(root, 'trip-end', '2026-12-02');
    submit(root);
    await nextTurn();
    await fixture.whenStable();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'Could not save the trip. Check its details and try again.',
    );
  });

  it('connects the trip editor to the places and trip HTTP endpoints', async () => {
    TestBed.overrideProvider(TripsApi, { useFactory: () => new TripsApi() });
    TestBed.overrideProvider(PlacesApi, { useFactory: () => new PlacesApi() });
    const fixture = TestBed.createComponent(TripsPage);
    const root = fixture.nativeElement as HTMLElement;
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/trips').flush([]);
    http.expectOne('/api/settings').flush({ home });
    http.expectOne('/api/places').flush([]);
    await fixture.whenStable();

    root.querySelector<HTMLButtonElement>('#add-trip')?.click();
    await fixture.whenStable();
    setInput(root, 'trip-name', 'Harbour Walk');
    setInput(root, 'trip-start', '2026-12-02');
    setInput(root, 'trip-end', '2026-12-02');
    setInput(root, 'new-place-name', 'New Harbour');
    await fixture.whenStable();
    root.querySelector<HTMLButtonElement>('#create-and-add-place')?.click();
    await fixture.whenStable();

    const placeRequest = http.expectOne('/api/places');
    expect(placeRequest.request.method).toBe('POST');
    expect(placeRequest.request.body).toEqual({ name: 'New Harbour' });
    const newPlace = { ...harbour, id: 'place-new', name: 'New Harbour' };
    placeRequest.flush(newPlace);
    await fixture.whenStable();

    submit(root);
    await fixture.whenStable();

    const request = http.expectOne('/api/trips');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      name: 'Harbour Walk',
      startDate: '2026-12-02',
      endDate: '2026-12-02',
      from: home,
      to: home,
      days: [{ date: '2026-12-02', stops: [newPlace.id] }],
    });
    request.flush({
      ...savedTrip,
      name: 'Harbour Walk',
      startDate: '2026-12-02',
      endDate: '2026-12-02',
      days: [{ date: '2026-12-02', stops: [newPlace.id] }],
    });
    await nextTurn();
    await fixture.whenStable();
    expect(root.querySelector('[role="status"]')?.textContent).toContain('Trip saved.');
    http.verify();
  });
});
