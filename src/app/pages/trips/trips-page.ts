import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormField, form, required, submit } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import { filterPlaces, taxonomyValues } from '../../core/place-taxonomy';
import { addTripStop, reconcileTripDays, removeTripStop } from '../../core/trip';
import type { HoboSettings, Trip, TripDay, TripEndpoint, TripFields } from '../../core/trip';
import type { Place } from '../../core/place';
import { PlacesApi } from '../../data/places-api';
import { TripsApi } from '../../data/trips-api';

interface TripEditorModel {
  name: string;
  startDate: string;
  endDate: string;
  fromChoice: string;
  fromCustomName: string;
  toChoice: string;
  toCustomName: string;
  newPlaceName: string;
}

const emptyEditor = (): TripEditorModel => ({
  name: '',
  startDate: '',
  endDate: '',
  fromChoice: 'home',
  fromCustomName: '',
  toChoice: 'home',
  toCustomName: '',
  newPlaceName: '',
});

@Component({
  selector: 'hobo-trips-page',
  imports: [FormField],
  templateUrl: './trips-page.html',
  styleUrl: './trips-page.scss',
})
export class TripsPage {
  private readonly tripsApi = inject(TripsApi);
  private readonly placesApi = inject(PlacesApi);
  protected readonly trips = signal<Trip[]>([]);
  protected readonly places = signal<Place[]>([]);
  protected readonly settings = signal<HoboSettings>({ home: null });
  protected readonly editorOpen = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly model = signal<TripEditorModel>(emptyEditor());
  protected readonly editorForm = form(this.model, (path) => {
    required(path.name);
    required(path.startDate);
    required(path.endDate);
    required(path.fromCustomName, {
      when: ({ valueOf }) => valueOf(path.fromChoice) === 'custom',
    });
    required(path.toCustomName, {
      when: ({ valueOf }) => valueOf(path.toChoice) === 'custom',
    });
  });
  protected readonly savedDays = signal<TripDay[]>([]);
  protected readonly tripDays = computed(() =>
    reconcileTripDays(this.model().startDate, this.model().endDate, this.savedDays()),
  );
  protected readonly selectedDate = signal('');
  protected readonly activeDate = computed(() => {
    const days = this.tripDays();
    const selected = this.selectedDate();
    return days.some((day) => day.date === selected) ? selected : (days[0]?.date ?? '');
  });
  protected readonly placeSearch = signal('');
  protected readonly categoryFilter = signal('');
  protected readonly tagFilter = signal('');
  protected readonly categories = computed(() => taxonomyValues(this.places(), 'category'));
  protected readonly tags = computed(() => taxonomyValues(this.places(), 'tag'));
  protected readonly filteredPlaces = computed(() => {
    const query = this.placeSearch().trim().toLocaleLowerCase();
    return filterPlaces(this.places(), this.categoryFilter(), this.tagFilter()).filter((place) =>
      place.name.toLocaleLowerCase().includes(query),
    );
  });
  protected readonly pageTitle = viewChild<ElementRef<HTMLElement>>('pageTitle');
  protected readonly error = signal('');
  protected readonly status = signal('');

  constructor() {
    void this.load();
  }

  protected startNew(): void {
    this.error.set('');
    this.status.set('');
    this.editingId.set(null);
    this.model.set(emptyEditor());
    this.savedDays.set([]);
    this.selectedDate.set('');
    this.resetFilters();
    this.editorOpen.set(true);
  }

  protected editTrip(trip: Trip): void {
    this.error.set('');
    this.status.set('');
    this.editingId.set(trip.id);
    this.model.set({
      name: trip.name,
      startDate: trip.startDate,
      endDate: trip.endDate,
      fromChoice: this.endpointChoice(trip.from),
      fromCustomName: this.isCustomEndpoint(trip.from) ? trip.from.name : '',
      toChoice: this.endpointChoice(trip.to),
      toCustomName: this.isCustomEndpoint(trip.to) ? trip.to.name : '',
      newPlaceName: '',
    });
    this.savedDays.set(trip.days);
    this.selectedDate.set(trip.startDate);
    this.resetFilters();
    this.editorOpen.set(true);
  }

  protected cancel(): void {
    this.editorOpen.set(false);
    this.editingId.set(null);
    this.error.set('');
    this.pageTitle()?.nativeElement.focus();
  }

  protected setPlaceSearch(event: Event): void {
    this.placeSearch.set((event.target as HTMLInputElement).value);
  }

  protected setCategoryFilter(event: Event): void {
    this.categoryFilter.set((event.target as HTMLSelectElement).value);
  }

  protected setTagFilter(event: Event): void {
    this.tagFilter.set((event.target as HTMLSelectElement).value);
  }

  protected setSelectedDate(event: Event): void {
    this.selectedDate.set((event.target as HTMLSelectElement).value);
  }

  protected addStop(placeId: string): void {
    const date = this.activeDate();
    if (!date) return;
    this.savedDays.set(addTripStop(this.tripDays(), date, placeId));
    const name = this.placeName(placeId);
    this.status.set(`${name} was added to ${date}.`);
  }

  protected removeStop(date: string, index: number): void {
    this.savedDays.set(removeTripStop(this.tripDays(), date, index));
  }

  protected placeName(id: string): string {
    return this.places().find((place) => place.id === id)?.name ?? 'Unknown place';
  }

  protected async createAndAddPlace(): Promise<void> {
    const name = this.model().newPlaceName.trim();
    const date = this.activeDate();
    this.error.set('');
    this.status.set('');
    try {
      const place = await firstValueFrom(this.placesApi.create({ name }));
      this.places.update((places) => [...places, place]);
      this.savedDays.set(addTripStop(this.tripDays(), date, place.id));
      this.model.update((model) => ({ ...model, newPlaceName: '' }));
      this.status.set(`${place.name} was added to the trip.`);
    } catch {
      this.error.set('Could not create the place. Try again.');
    }
  }

  protected async save(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    this.status.set('');
    await submit(this.editorForm, async () => {
      const model = this.model();
      const fields: TripFields = {
        name: model.name.trim(),
        startDate: model.startDate,
        endDate: model.endDate,
        from: this.endpoint(model.fromChoice, model.fromCustomName),
        to: this.endpoint(model.toChoice, model.toCustomName),
        days: this.tripDays(),
      };
      this.error.set('');
      try {
        const id = this.editingId();
        const saved = id
          ? await firstValueFrom(this.tripsApi.update(id, fields))
          : await firstValueFrom(this.tripsApi.create(fields));
        this.trips.update((trips) =>
          id ? trips.map((trip) => (trip.id === saved.id ? saved : trip)) : [...trips, saved],
        );
        this.editorOpen.set(false);
        this.editingId.set(null);
        this.status.set('Trip saved.');
        this.pageTitle()?.nativeElement.focus();
      } catch (error) {
        this.error.set(
          this.apiError(error) ?? 'Could not save the trip. Check its details and try again.',
        );
      }
    });
  }

  private endpoint(choice: string, customName: string): TripEndpoint | null {
    if (choice === 'home') return this.settings().home;
    if (choice === 'none') return null;
    if (choice === 'custom') return { name: customName.trim(), location: null, placeId: null };
    const placeId = choice.slice('place:'.length);
    const place = this.places().find((candidate) => candidate.id === placeId)!;
    return { name: place.name, location: place.location, placeId: place.id };
  }

  private endpointChoice(endpoint: TripEndpoint | null): string {
    if (endpoint === null) return 'none';
    if (this.sameEndpoint(endpoint, this.settings().home)) return 'home';
    if (endpoint.placeId && this.places().some((place) => place.id === endpoint.placeId)) {
      return `place:${endpoint.placeId}`;
    }
    return 'custom';
  }

  private isCustomEndpoint(endpoint: TripEndpoint | null): endpoint is TripEndpoint {
    return endpoint !== null && this.endpointChoice(endpoint) === 'custom';
  }

  private sameEndpoint(left: TripEndpoint, right: TripEndpoint | null): boolean {
    return (
      right !== null &&
      left.name === right.name &&
      left.placeId === right.placeId &&
      left.location?.lat === right.location?.lat &&
      left.location?.lng === right.location?.lng
    );
  }

  private apiError(error: unknown): string | null {
    if (!(error instanceof HttpErrorResponse)) return null;
    const response = error.error as { errors?: unknown } | null;
    return Array.isArray(response?.errors) &&
      response.errors.every((message: unknown) => typeof message === 'string')
      ? (response.errors as string[]).join('. ')
      : null;
  }

  private resetFilters(): void {
    this.placeSearch.set('');
    this.categoryFilter.set('');
    this.tagFilter.set('');
  }

  private async load(): Promise<void> {
    try {
      const [trips, settings, places] = await Promise.all([
        firstValueFrom(this.tripsApi.list()),
        firstValueFrom(this.tripsApi.getSettings()),
        firstValueFrom(this.placesApi.list()),
      ]);
      this.trips.set(trips);
      this.settings.set(settings);
      this.places.set(places);
    } catch {
      this.error.set('Could not load trips and places. Try again.');
    }
  }
}
