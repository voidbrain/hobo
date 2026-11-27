import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
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
    tripsApi.list.mockReturnValueOnce(of([savedTrip]));
    const updated = { ...savedTrip, name: 'Coast Loop Extended' };
    tripsApi.update.mockReturnValueOnce(of(updated));
    const fixture = TestBed.createComponent(TripsPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('.edit-trip')?.click();
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
