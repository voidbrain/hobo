import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { HoboSettings, Trip } from '../core/trip';
import { TripsApi } from './trips-api';

// Invented trip and home only.
const trip: Trip = {
  id: 't-1',
  name: 'Coast Loop',
  startDate: '2026-09-01',
  endDate: '2026-09-02',
  from: { name: 'Harbour Base', location: { lat: -33.86, lng: 151.21 }, placeId: null },
  to: { name: 'Harbour Base', location: { lat: -33.86, lng: 151.21 }, placeId: null },
  days: [
    { date: '2026-09-01', stops: ['p-1'] },
    { date: '2026-09-02', stops: [] },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('TripsApi', () => {
  let api: TripsApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(TripsApi);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('reaches trips and home settings through the local server', () => {
    const seen: unknown[] = [];
    const settings: HoboSettings = { home: trip.from };

    api.getSettings().subscribe((v) => seen.push(v));
    http.expectOne({ method: 'GET', url: '/api/settings' }).flush(settings);

    api.updateSettings(settings).subscribe((v) => seen.push(v));
    const patchSettings = http.expectOne({ method: 'PATCH', url: '/api/settings' });
    expect(patchSettings.request.body).toEqual(settings);
    patchSettings.flush(settings);

    api.list().subscribe((v) => seen.push(v));
    http.expectOne({ method: 'GET', url: '/api/trips' }).flush([trip]);

    api.get('t 1').subscribe((v) => seen.push(v));
    http.expectOne({ method: 'GET', url: '/api/trips/t%201' }).flush(trip);

    api
      .create({ name: 'Coast Loop', startDate: '2026-09-01', endDate: '2026-09-02' })
      .subscribe((v) => seen.push(v));
    http.expectOne({ method: 'POST', url: '/api/trips' }).flush(trip);

    api.update('t-1', { name: 'Coast Loop Extended' }).subscribe((v) => seen.push(v));
    http
      .expectOne({ method: 'PATCH', url: '/api/trips/t-1' })
      .flush({ ...trip, name: 'Coast Loop Extended' });

    api.remove('t-1').subscribe(() => seen.push('removed'));
    http
      .expectOne({ method: 'DELETE', url: '/api/trips/t-1' })
      .flush(null, { status: 204, statusText: 'No Content' });

    expect(seen).toEqual([
      settings,
      settings,
      [trip],
      trip,
      trip,
      { ...trip, name: 'Coast Loop Extended' },
      'removed',
    ]);
  });
});
