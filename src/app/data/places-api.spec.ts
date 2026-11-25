import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { Place } from '../core/place';
import { PlacesApi } from './places-api';

// Invented place only.
const place: Place = {
  id: 'p-1',
  name: 'Lantern Hill',
  description: '',
  images: [],
  category: null,
  tags: [],
  notes: '',
  location: null,
  timeSpent: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('PlacesApi', () => {
  let api: PlacesApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(PlacesApi);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lists, reads, creates, updates and deletes through the local server', () => {
    const seen: unknown[] = [];
    api.list().subscribe((v) => seen.push(v));
    http.expectOne({ method: 'GET', url: '/api/places' }).flush([place]);

    api.get('p 1').subscribe((v) => seen.push(v));
    http.expectOne({ method: 'GET', url: '/api/places/p%201' }).flush(place);

    api.create({ name: 'Lantern Hill' }).subscribe((v) => seen.push(v));
    const create = http.expectOne({ method: 'POST', url: '/api/places' });
    expect(create.request.body).toEqual({ name: 'Lantern Hill' });
    create.flush(place);

    api.update('p-1', { timeSpent: '2h' }).subscribe((v) => seen.push(v));
    const update = http.expectOne({ method: 'PATCH', url: '/api/places/p-1' });
    expect(update.request.body).toEqual({ timeSpent: '2h' });
    update.flush({ ...place, timeSpent: '2h' });

    api.remove('p-1').subscribe(() => seen.push('removed'));
    http
      .expectOne({ method: 'DELETE', url: '/api/places/p-1' })
      .flush(null, { status: 204, statusText: 'No Content' });

    expect(seen).toEqual([[place], place, place, { ...place, timeSpent: '2h' }, 'removed']);
  });
});
