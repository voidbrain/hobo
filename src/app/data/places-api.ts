import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Place, PlaceFields, PlacePatch } from '../core/place';

const BASE = '/api/places';

/** The one way the app reaches places: the local server (server/), proxied at /api while developing. */
@Service()
export class PlacesApi {
  private readonly http = inject(HttpClient);

  list(): Observable<Place[]> {
    return this.http.get<Place[]>(BASE);
  }

  get(id: string): Observable<Place> {
    return this.http.get<Place>(`${BASE}/${encodeURIComponent(id)}`);
  }

  /** A name is enough; the server validates and fills the rest. */
  create(fields: Pick<PlaceFields, 'name'> & PlacePatch): Observable<Place> {
    return this.http.post<Place>(BASE, fields);
  }

  update(id: string, patch: PlacePatch): Observable<Place> {
    return this.http.patch<Place>(`${BASE}/${encodeURIComponent(id)}`, patch);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${BASE}/${encodeURIComponent(id)}`);
  }
}
