import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { catchError, throwError, type Observable } from 'rxjs';
import type {
  GeocodeCandidate,
  MapErrorCode,
  MatrixRequest,
  MatrixResult,
  RouteRequest,
  RouteResult,
} from './map-provider';

const BASE = '/api/maps';

const KNOWN_CODES: ReadonlySet<MapErrorCode> = new Set([
  'missing_key',
  'invalid_key',
  'quota_exceeded',
  'unreachable_route',
  'upstream_error',
  'bad_request',
]);

/** Structured user-facing error from `/api/maps` (including quota limits and missing keys). */
export class MapsApiError extends Error {
  readonly status: number;
  readonly code: MapErrorCode;
  readonly userMessage: string;
  readonly errors: readonly string[];

  constructor(status: number, code: MapErrorCode, errors: readonly string[]) {
    const userMessage = errors[0] ?? 'Map service request failed.';
    super(userMessage);
    this.name = 'MapsApiError';
    this.status = status;
    this.code = code;
    this.userMessage = userMessage;
    this.errors = errors;
  }
}

function fallbackCodeForStatus(status: number): MapErrorCode {
  if (status === 429) return 'quota_exceeded';
  if (status === 503) return 'missing_key';
  if (status === 422) return 'unreachable_route';
  if (status >= 400 && status < 500) return 'bad_request';
  return 'upstream_error';
}

function toMapsApiError(err: unknown): MapsApiError {
  if (err instanceof MapsApiError) return err;
  if (err instanceof HttpErrorResponse) {
    const body =
      typeof err.error === 'object' && err.error !== null
        ? (err.error as Record<string, unknown>)
        : undefined;
    const rawCode = body?.['code'];
    const code: MapErrorCode =
      typeof rawCode === 'string' && KNOWN_CODES.has(rawCode as MapErrorCode)
        ? (rawCode as MapErrorCode)
        : fallbackCodeForStatus(err.status);
    const rawErrors = body?.['errors'];
    const errors =
      Array.isArray(rawErrors) &&
      rawErrors.every((item): item is string => typeof item === 'string' && item.trim().length > 0)
        ? rawErrors
        : err.status === 0
          ? ['Could not reach the local Hobo service.']
          : ['Map service request failed.'];
    return new MapsApiError(err.status, code, errors);
  }
  return new MapsApiError(0, 'upstream_error', ['Map service request failed.']);
}

/** The one way the Angular app reaches routing, matrix, geocoding and autocomplete (`/api/maps`). */
@Service()
export class MapsApi {
  private readonly http = inject(HttpClient);

  route(request: RouteRequest): Observable<RouteResult> {
    return this.http
      .post<RouteResult>(`${BASE}/route`, request)
      .pipe(catchError((err: unknown) => throwError(() => toMapsApiError(err))));
  }

  matrix(request: MatrixRequest): Observable<MatrixResult> {
    return this.http
      .post<MatrixResult>(`${BASE}/matrix`, request)
      .pipe(catchError((err: unknown) => throwError(() => toMapsApiError(err))));
  }

  geocode(query: string, limit?: number): Observable<GeocodeCandidate[]> {
    let params = new HttpParams().set('q', query);
    if (limit !== undefined) params = params.set('limit', String(limit));
    return this.http
      .get<GeocodeCandidate[]>(`${BASE}/geocode`, { params })
      .pipe(catchError((err: unknown) => throwError(() => toMapsApiError(err))));
  }

  autocomplete(query: string, limit?: number): Observable<GeocodeCandidate[]> {
    let params = new HttpParams().set('q', query);
    if (limit !== undefined) params = params.set('limit', String(limit));
    return this.http
      .get<GeocodeCandidate[]>(`${BASE}/autocomplete`, { params })
      .pipe(catchError((err: unknown) => throwError(() => toMapsApiError(err))));
  }
}
