import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type { HoboSettings, NewTripInput, Trip, TripPatch } from '../core/trip';

const TRIPS_BASE = '/api/trips';
const SETTINGS_BASE = '/api/settings';

/** Client service for trips and local home settings (`server/`, proxied at `/api` while developing). */
@Service()
export class TripsApi {
  private readonly http = inject(HttpClient);

  getSettings(): Observable<HoboSettings> {
    return this.http.get<HoboSettings>(SETTINGS_BASE);
  }

  updateSettings(patch: Partial<HoboSettings>): Observable<HoboSettings> {
    return this.http.patch<HoboSettings>(SETTINGS_BASE, patch);
  }

  list(): Observable<Trip[]> {
    return this.http.get<Trip[]>(TRIPS_BASE);
  }

  get(id: string): Observable<Trip> {
    return this.http.get<Trip>(`${TRIPS_BASE}/${encodeURIComponent(id)}`);
  }

  create(input: NewTripInput): Observable<Trip> {
    return this.http.post<Trip>(TRIPS_BASE, input);
  }

  update(id: string, patch: TripPatch): Observable<Trip> {
    return this.http.patch<Trip>(`${TRIPS_BASE}/${encodeURIComponent(id)}`, patch);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${TRIPS_BASE}/${encodeURIComponent(id)}`);
  }
}
