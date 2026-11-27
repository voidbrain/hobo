import type { Place, Validation } from './place';

export type TaxonomyKind = 'category' | 'tag';
export type PlaceGroupBy = TaxonomyKind | 'none';

export interface TaxonomyChange {
  readonly kind: TaxonomyKind;
  readonly source: string;
  readonly target: string | null;
}

export interface PlaceGroup {
  readonly label: string | null;
  readonly places: readonly Place[];
}

/** Validates the one field and destination allowed by the bulk taxonomy endpoint. */
export function validateTaxonomyChange(input: unknown): Validation<TaxonomyChange> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, errors: ['a taxonomy change must be an object'] };
  }
  const value = input as Record<string, unknown>;
  const errors: string[] = [];
  for (const key of Object.keys(value)) {
    if (key !== 'kind' && key !== 'source' && key !== 'target') {
      errors.push(`unknown field ${key}`);
    }
  }
  if (value['kind'] !== 'category' && value['kind'] !== 'tag') {
    errors.push('kind must be category or tag');
  }
  const kind = value['kind'] === 'tag' ? 'tag' : 'category';
  const source = typeof value['source'] === 'string' ? value['source'].trim() : '';
  if (!source) errors.push('source is required');

  let target: string | null;
  if (value['target'] === null) target = null;
  else if (typeof value['target'] !== 'string') {
    errors.push('target must be text or null');
    target = null;
  } else {
    target = value['target'].trim();
    if (!target) errors.push('target must not be blank; use null to clear it');
  }
  if (source && source === target) errors.push('target must differ from source');
  return errors.length
    ? { ok: false, errors }
    : { ok: true, value: { kind: kind as TaxonomyKind, source, target } };
}

/** Returns the patch for one place, or null when it does not use the source value. */
export function reassignPlaceTaxonomy(
  place: Place,
  kind: TaxonomyKind,
  source: string,
  target: string | null,
): Place | null {
  if (kind === 'category') {
    return place.category === source ? { ...place, category: target } : null;
  }
  if (!place.tags.includes(source)) return null;
  const tags = target === null ? place.tags.filter((tag) => tag !== source) : place.tags;
  const reassigned = target === null ? tags : tags.map((tag) => (tag === source ? target : tag));
  return { ...place, tags: [...new Set(reassigned)] };
}

export function taxonomyValues(places: readonly Place[], kind: TaxonomyKind): string[] {
  const values =
    kind === 'category'
      ? places.flatMap((place) => (place.category ? [place.category] : []))
      : places.flatMap((place) => place.tags);
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export function filterPlaces(places: readonly Place[], category: string, tag: string): Place[] {
  return places.filter(
    (place) => (!category || place.category === category) && (!tag || place.tags.includes(tag)),
  );
}

export function groupPlaces(places: readonly Place[], groupBy: PlaceGroupBy): PlaceGroup[] {
  if (groupBy === 'none') return places.length ? [{ label: null, places }] : [];

  const grouped = new Map<string, Place[]>();
  for (const place of places) {
    const labels =
      groupBy === 'category'
        ? [place.category ?? 'No category']
        : place.tags.length
          ? place.tags
          : ['No tags'];
    for (const label of labels) {
      const group = grouped.get(label) ?? [];
      group.push(place);
      grouped.set(label, group);
    }
  }
  return [...grouped]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, members]) => ({ label, places: members }));
}
