import { Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormField, form, required, submit } from '@angular/forms/signals';
import {
  Subject,
  catchError,
  distinctUntilChanged,
  firstValueFrom,
  map,
  of,
  switchMap,
  timer,
} from 'rxjs';
import type { Place, PlaceFields, PlacePatch } from '../../core/place';
import { PlacesApi } from '../../data/places-api';
import type { GeocodeCandidate, MapPoint } from '../../maps/map-provider';
import { MapsApi } from '../../maps/maps-api';
import { MapView, type MapMarker } from '../../maps/map-view';

interface PlaceFormValue {
  name: string;
  description: string;
  category: string;
  tags: string;
  notes: string;
  timeSpent: string;
}

const emptyForm = (): PlaceFormValue => ({
  name: '',
  description: '',
  category: '',
  tags: '',
  notes: '',
  timeSpent: '',
});

@Component({
  selector: 'hobo-places-page',
  imports: [FormField, MapView],
  templateUrl: './places-page.html',
  styleUrl: './places-page.scss',
})
export class PlacesPage {
  private readonly api = inject(PlacesApi);
  private readonly mapsApi = inject(MapsApi);
  private readonly locationQueries = new Subject<string>();
  protected readonly places = signal<Place[]>([]);
  protected readonly formOpen = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly error = signal('');
  protected readonly model = signal<PlaceFormValue>(emptyForm());
  protected readonly placeForm = form(this.model, (path) => required(path.name));
  protected readonly location = signal<MapPoint | null>(null);
  protected readonly locationLabel = signal('');
  protected readonly locationQuery = signal('');
  protected readonly suggestions = signal<GeocodeCandidate[]>([]);
  protected readonly searchError = signal('');
  protected readonly searchComplete = signal(false);
  protected readonly locationSearch = viewChild<ElementRef<HTMLInputElement>>('locationSearch');
  protected readonly locationSummary = computed(() => {
    const point = this.location();
    return point ? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` : '';
  });
  protected readonly locationMarkers = computed<readonly MapMarker[]>(() => {
    const point = this.location();
    return point ? [{ location: point, label: this.locationLabel() || 'Selected location' }] : [];
  });

  constructor() {
    void this.loadPlaces();
    this.locationQueries
      .pipe(
        distinctUntilChanged(),
        switchMap((query) => {
          const normalized = query.trim();
          if (normalized.length < 3) return of({ candidates: [], error: '' });
          return timer(250).pipe(
            switchMap(() => this.mapsApi.autocomplete(normalized, 5)),
            map((candidates) => ({ candidates, error: '' })),
            catchError(() =>
              of({
                candidates: [],
                error: 'Could not search for places. Check map settings and try again.',
              }),
            ),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe(({ candidates, error }) => {
        this.suggestions.set(candidates);
        this.searchError.set(error);
        this.searchComplete.set(true);
      });
  }

  protected startNew(): void {
    this.error.set('');
    this.formOpen.set(true);
    this.editingId.set(null);
    this.model.set(emptyForm());
    this.location.set(null);
    this.locationLabel.set('');
    this.locationQuery.set('');
    this.suggestions.set([]);
    this.searchComplete.set(false);
    this.locationQueries.next('');
  }

  protected edit(place: Place): void {
    this.error.set('');
    this.formOpen.set(true);
    this.editingId.set(place.id);
    this.location.set(place.location);
    this.locationLabel.set(place.name);
    this.locationQuery.set('');
    this.suggestions.set([]);
    this.searchComplete.set(false);
    this.locationQueries.next('');
    this.model.set({
      name: place.name,
      description: place.description,
      category: place.category ?? '',
      tags: place.tags.join(', '),
      notes: place.notes,
      timeSpent: place.timeSpent ?? '',
    });
  }

  protected cancel(): void {
    this.error.set('');
    this.formOpen.set(false);
    this.editingId.set(null);
    this.locationQueries.next('');
  }

  protected searchLocation(event: Event): void {
    const query = (event.target as HTMLInputElement).value;
    this.locationQuery.set(query);
    this.searchComplete.set(false);
    this.locationQueries.next(query);
  }

  protected selectSuggestion(candidate: GeocodeCandidate): void {
    this.location.set(candidate.location);
    this.locationLabel.set(candidate.label);
    this.locationQuery.set(candidate.label);
    this.suggestions.set([]);
    this.searchError.set('');
    this.searchComplete.set(false);
    this.locationQueries.next('');
    this.locationSearch()?.nativeElement.focus();
  }

  protected pickLocation(point: MapPoint): void {
    this.location.set(point);
    this.locationLabel.set(this.model().name || 'Selected location');
    this.suggestions.set([]);
    this.searchError.set('');
    this.searchComplete.set(false);
    this.locationQueries.next('');
  }

  protected clearLocation(): void {
    this.location.set(null);
    this.locationLabel.set('');
  }

  protected save(event: SubmitEvent): void {
    event.preventDefault();
    submit(this.placeForm, async () => {
      const value = this.model();
      const fields: Pick<PlaceFields, 'name'> & PlacePatch = {
        name: value.name,
        location: this.location(),
        description: value.description,
        category: value.category.trim() || null,
        tags: value.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        notes: value.notes,
        timeSpent: value.timeSpent
          ? (value.timeSpent as NonNullable<PlaceFields['timeSpent']>)
          : null,
      };

      try {
        const currentId = this.editingId();
        const saved = currentId
          ? await firstValueFrom(this.api.update(currentId, fields))
          : await firstValueFrom(this.api.create(fields));
        this.places.update((places) =>
          currentId
            ? places.map((place) => (place.id === saved.id ? saved : place))
            : [...places, saved],
        );
        this.editingId.set(null);
        this.formOpen.set(false);
        this.error.set('');
      } catch {
        this.error.set('Could not save the place. Try again.');
      }
    });
  }

  private async loadPlaces(): Promise<void> {
    try {
      this.places.set(await firstValueFrom(this.api.list()));
    } catch {
      this.error.set('Could not load places. Try again.');
    }
  }
}
