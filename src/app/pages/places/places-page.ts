import { Component, inject, signal } from '@angular/core';
import { FormField, form, required, submit } from '@angular/forms/signals';
import { firstValueFrom } from 'rxjs';
import type { Place, PlaceFields, PlacePatch } from '../../core/place';
import { PlacesApi } from '../../data/places-api';

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
  imports: [FormField],
  templateUrl: './places-page.html',
  styleUrl: './places-page.scss',
})
export class PlacesPage {
  private readonly api = inject(PlacesApi);
  protected readonly places = signal<Place[]>([]);
  protected readonly formOpen = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly error = signal('');
  protected readonly model = signal<PlaceFormValue>(emptyForm());
  protected readonly placeForm = form(this.model, (path) => required(path.name));

  constructor() {
    void this.loadPlaces();
  }

  protected startNew(): void {
    this.error.set('');
    this.formOpen.set(true);
    this.editingId.set(null);
    this.model.set(emptyForm());
  }

  protected edit(place: Place): void {
    this.error.set('');
    this.formOpen.set(true);
    this.editingId.set(place.id);
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
  }

  protected save(event: SubmitEvent): void {
    event.preventDefault();
    submit(this.placeForm, async () => {
      const value = this.model();
      const fields: Pick<PlaceFields, 'name'> & PlacePatch = {
        name: value.name,
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
