import { HttpErrorResponse } from '@angular/common/http';
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
import {
  filterPlaces,
  groupPlaces,
  taxonomyValues,
  validateTaxonomyChange,
  type PlaceGroupBy,
  type TaxonomyKind,
} from '../../core/place-taxonomy';
import { PlacesApi } from '../../data/places-api';
import type { GeocodeCandidate, MapPoint } from '../../maps/map-provider';
import { MapsApi, MapsApiError } from '../../maps/maps-api';
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
  protected readonly categoryFilter = signal('');
  protected readonly tagFilter = signal('');
  protected readonly groupBy = signal<PlaceGroupBy>('none');
  protected readonly visibleGroups = computed(() =>
    groupPlaces(
      filterPlaces(this.places(), this.categoryFilter(), this.tagFilter()),
      this.groupBy(),
    ),
  );
  protected readonly categories = computed(() => taxonomyValues(this.places(), 'category'));
  protected readonly tags = computed(() => taxonomyValues(this.places(), 'tag'));
  protected readonly taxonomyKind = signal<TaxonomyKind>('category');
  protected readonly taxonomySource = signal('');
  protected readonly taxonomyAction = signal<'rename' | 'merge' | 'delete'>('rename');
  protected readonly taxonomyTarget = signal('');
  protected readonly taxonomySources = computed(() =>
    taxonomyValues(this.places(), this.taxonomyKind()),
  );
  protected readonly taxonomyTargets = computed(() =>
    this.taxonomySources().filter((value) => value !== this.taxonomySource()),
  );
  protected readonly taxonomyStatus = signal('');
  protected readonly taxonomyError = signal('');
  protected readonly formOpen = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly editingPlace = computed(() => {
    const id = this.editingId();
    return id ? (this.places().find((place) => place.id === id) ?? null) : null;
  });
  protected readonly placesTitle = viewChild<ElementRef<HTMLElement>>('placesTitle');
  protected readonly error = signal('');
  protected readonly placeStatus = signal('');
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
            catchError((error: unknown) =>
              of({
                candidates: [],
                error:
                  error instanceof MapsApiError && error.code === 'missing_key'
                    ? 'Place search needs an OpenRouteService key. Add openRouteServiceApiKey to server/config.local.json; see README for setup.'
                    : 'Could not search for places. Check map settings and try again.',
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
    this.placeStatus.set('');
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
    this.placeStatus.set('');
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

  protected async deletePlace(place: Place): Promise<void> {
    if (!globalThis.confirm(`Delete "${place.name}"? This cannot be undone.`)) return;
    this.error.set('');
    this.placeStatus.set('');
    try {
      await firstValueFrom(this.api.remove(place.id));
      this.places.update((places) => places.filter((saved) => saved.id !== place.id));
      if (this.editingId() === place.id) {
        this.editingId.set(null);
        this.formOpen.set(false);
      }
      this.placeStatus.set(`${place.name} was deleted.`);
      this.placesTitle()?.nativeElement.focus();
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        const response = error.error as { errors?: unknown } | null;
        if (
          Array.isArray(response?.errors) &&
          response.errors.every((message: unknown) => typeof message === 'string')
        ) {
          this.error.set((response.errors as string[]).join(' '));
          return;
        }
      }
      this.error.set(`Could not delete ${place.name}. Try again.`);
    }
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

  protected setCategoryFilter(event: Event): void {
    this.categoryFilter.set((event.target as HTMLSelectElement).value);
  }

  protected setTagFilter(event: Event): void {
    this.tagFilter.set((event.target as HTMLSelectElement).value);
  }

  protected setGroupBy(event: Event): void {
    this.groupBy.set((event.target as HTMLSelectElement).value as PlaceGroupBy);
  }

  protected setTaxonomyKind(event: Event): void {
    this.taxonomyKind.set((event.target as HTMLSelectElement).value as TaxonomyKind);
    this.taxonomySource.set('');
    this.taxonomyTarget.set('');
    this.taxonomyStatus.set('');
    this.taxonomyError.set('');
  }

  protected setTaxonomySource(event: Event): void {
    this.taxonomySource.set((event.target as HTMLSelectElement).value);
    this.taxonomyTarget.set('');
  }

  protected setTaxonomyAction(event: Event): void {
    this.taxonomyAction.set(
      (event.target as HTMLSelectElement).value as 'rename' | 'merge' | 'delete',
    );
    this.taxonomyTarget.set('');
  }

  protected setTaxonomyTarget(event: Event): void {
    this.taxonomyTarget.set((event.target as HTMLInputElement | HTMLSelectElement).value);
  }

  protected async applyTaxonomy(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const kind = this.taxonomyKind();
    const source = this.taxonomySource();
    const action = this.taxonomyAction();
    const target = this.taxonomyTarget().trim();
    if (!source) {
      this.taxonomyError.set(`Choose a ${kind} to update.`);
      return;
    }
    if (
      action === 'rename' &&
      (!target || target === source || this.taxonomySources().includes(target))
    ) {
      this.taxonomyError.set(
        this.taxonomySources().includes(target)
          ? 'That value already exists. Choose Merge instead.'
          : 'Enter a different name.',
      );
      return;
    }
    if (action === 'merge' && (!target || !this.taxonomyTargets().includes(target))) {
      this.taxonomyError.set(`Choose an existing ${kind} to merge into.`);
      return;
    }
    if (action === 'delete' && target && !this.taxonomyTargets().includes(target)) {
      this.taxonomyError.set(`Choose an existing ${kind} or leave the destination empty.`);
      return;
    }
    const checked = validateTaxonomyChange({ kind, source, target: target || null });
    if (!checked.ok) {
      this.taxonomyError.set(checked.errors.join('. '));
      return;
    }

    this.taxonomyError.set('');
    this.taxonomyStatus.set('');
    try {
      const changed = await firstValueFrom(
        this.api.reassignTaxonomy(checked.value.kind, checked.value.source, checked.value.target),
      );
      const updates = new Map(changed.map((place) => [place.id, place]));
      this.places.update((places) => places.map((place) => updates.get(place.id) ?? place));
      if (kind === 'category' && this.categoryFilter() === source) {
        this.categoryFilter.set(target);
      }
      if (kind === 'tag' && this.tagFilter() === source) this.tagFilter.set(target);
      this.taxonomySource.set('');
      this.taxonomyTarget.set('');
      this.taxonomyStatus.set(`Updated ${changed.length} places.`);
    } catch {
      this.taxonomyError.set(`Could not update ${kind}s. Try again.`);
    }
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
