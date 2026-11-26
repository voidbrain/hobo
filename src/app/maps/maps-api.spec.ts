import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { GeocodeCandidate, MapPoint, MatrixResult, RouteResult } from './map-provider';
import { MapsApi, MapsApiError } from './maps-api';

// Invented places and coordinates only.
const PORTWIND: MapPoint = { lat: 45.1, lng: 9.1 };
const MILLHAVEN: MapPoint = { lat: 45.22, lng: 9.25 };

describe('MapsApi (F-007-T03)', () => {
  let api: MapsApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(MapsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('calls /api/maps for route, matrix, geocode and autocomplete', () => {
    const seen: unknown[] = [];

    const sampleRoute: RouteResult = {
      provider: 'openrouteservice',
      profile: 'driving-car',
      from: PORTWIND,
      to: MILLHAVEN,
      distanceMetres: 21_451,
      travelMinutes: 27,
      geometry: [PORTWIND, MILLHAVEN],
      cached: false,
    };
    api.route({ from: PORTWIND, to: MILLHAVEN }).subscribe((v) => seen.push(v));
    const routeReq = http.expectOne({ method: 'POST', url: '/api/maps/route' });
    expect(routeReq.request.body).toEqual({ from: PORTWIND, to: MILLHAVEN });
    routeReq.flush(sampleRoute);

    const sampleMatrix: MatrixResult = {
      provider: 'openrouteservice',
      profile: 'driving-car',
      points: [PORTWIND, MILLHAVEN],
      cells: [
        { fromIndex: 0, toIndex: 0, distanceMetres: 0, travelMinutes: 0 },
        { fromIndex: 0, toIndex: 1, distanceMetres: 21_451, travelMinutes: 27 },
        { fromIndex: 1, toIndex: 0, distanceMetres: 21_600, travelMinutes: 28 },
        { fromIndex: 1, toIndex: 1, distanceMetres: 0, travelMinutes: 0 },
      ],
    };
    api.matrix({ points: [PORTWIND, MILLHAVEN] }).subscribe((v) => seen.push(v));
    const matrixReq = http.expectOne({ method: 'POST', url: '/api/maps/matrix' });
    expect(matrixReq.request.body).toEqual({ points: [PORTWIND, MILLHAVEN] });
    matrixReq.flush(sampleMatrix);

    const candidate: GeocodeCandidate = {
      label: 'Harbour Quay, Portwind',
      location: PORTWIND,
      country: 'Inventedland',
      region: 'Coast Shire',
      locality: 'Portwind',
    };
    api.geocode('Portwind Harbour', 4).subscribe((v) => seen.push(v));
    http
      .expectOne({ method: 'GET', url: '/api/maps/geocode?q=Portwind%20Harbour&limit=4' })
      .flush([candidate]);

    api.autocomplete('Port').subscribe((v) => seen.push(v));
    http.expectOne({ method: 'GET', url: '/api/maps/autocomplete?q=Port' }).flush([candidate]);

    expect(seen).toEqual([sampleRoute, sampleMatrix, [candidate], [candidate]]);
  });

  it('maps quota limits and missing-key errors into user-facing MapsApiError instances', () => {
    let caughtQuota: unknown;
    api.route({ from: PORTWIND, to: MILLHAVEN }).subscribe({
      error: (err: unknown) => (caughtQuota = err),
    });
    http.expectOne('/api/maps/route').flush(
      {
        code: 'quota_exceeded',
        errors: ['OpenRouteService rate or daily quota limit reached.'],
      },
      { status: 429, statusText: 'Too Many Requests' },
    );

    expect(caughtQuota).toBeInstanceOf(MapsApiError);
    expect((caughtQuota as MapsApiError).status).toBe(429);
    expect((caughtQuota as MapsApiError).code).toBe('quota_exceeded');
    expect((caughtQuota as MapsApiError).userMessage).toContain('quota limit');

    let caughtMissing: unknown;
    api.geocode('Portwind').subscribe({
      error: (err: unknown) => (caughtMissing = err),
    });
    http.expectOne('/api/maps/geocode?q=Portwind').flush(
      {
        code: 'missing_key',
        errors: ['OpenRouteService API key is not configured.'],
      },
      { status: 503, statusText: 'Service Unavailable' },
    );

    expect(caughtMissing).toBeInstanceOf(MapsApiError);
    expect((caughtMissing as MapsApiError).status).toBe(503);
    expect((caughtMissing as MapsApiError).code).toBe('missing_key');
    expect((caughtMissing as MapsApiError).userMessage).toContain('not configured');
  });
});
