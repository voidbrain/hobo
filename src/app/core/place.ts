// Framework-free domain code: no Angular imports (eslint and check:conventions enforce it).
// The server (server/) imports this file under Node's type stripping, so its only relative import is type-only.
import type { TimeSpent } from './time-spent';

/** A point on the map, in decimal degrees (WGS 84). */
export interface GeoPoint {
  lat: number;
  lng: number;
}

/** What the owner records about a place. Only the name is required; the rest is filled in later. */
export interface PlaceFields {
  name: string;
  description: string;
  /** References to image files in the server's data folder (upload is F-002-T03). */
  images: string[];
  category: string | null;
  tags: string[];
  notes: string;
  location: GeoPoint | null;
  /** Time on site, queues and movement on site included; null until the owner decides. */
  timeSpent: TimeSpent | null;
}

/** A stored place: the fields plus identity and timestamps the store assigns. */
export interface Place extends PlaceFields {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export type PlacePatch = Partial<PlaceFields>;

export type Validation<T> = { ok: true; value: T } | { ok: false; errors: string[] };

export const PLACE_LIMITS = {
  name: 200,
  category: 100,
  text: 10_000,
  tag: 50,
  tags: 50,
  images: 100,
} as const;

// Kept in step with the TimeSpent union by the `satisfies` check: a value added there fails to compile here.
const TIME_SPENT_VALUES = { '2h': true, 'half-day': true, 'full-day': true } satisfies Record<
  TimeSpent,
  true
>;

// An image reference is a file name in the data folder: no path separators, no leading dot.
const IMAGE_REF = /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,127}$/;

const FIELDS: readonly (keyof PlaceFields)[] = [
  'name',
  'description',
  'images',
  'category',
  'tags',
  'notes',
  'location',
  'timeSpent',
];

const EMPTY: Omit<PlaceFields, 'name'> = {
  description: '',
  images: [],
  category: null,
  tags: [],
  notes: '',
  location: null,
  timeSpent: null,
};

type Checked<T> = { value: T } | { error: string };

function text(value: unknown, field: string, max: number, required = false): Checked<string> {
  if (typeof value !== 'string') return { error: `${field} must be text` };
  const trimmed = value.trim();
  if (required && !trimmed) return { error: `${field} is required` };
  if (trimmed.length > max) return { error: `${field} is longer than ${max} characters` };
  return { value: trimmed };
}

function checkField(key: keyof PlaceFields, value: unknown): Checked<PlaceFields[typeof key]> {
  switch (key) {
    case 'name':
      return text(value, 'name', PLACE_LIMITS.name, true);
    case 'description':
    case 'notes':
      return text(value, key, PLACE_LIMITS.text);
    case 'category': {
      if (value === null) return { value: null };
      const checked = text(value, 'category', PLACE_LIMITS.category);
      return 'value' in checked && !checked.value ? { value: null } : checked;
    }
    case 'tags': {
      if (!Array.isArray(value)) return { error: 'tags must be a list' };
      const tags: string[] = [];
      for (const tag of value) {
        const checked = text(tag, 'a tag', PLACE_LIMITS.tag, true);
        if ('error' in checked) return checked;
        if (!tags.includes(checked.value)) tags.push(checked.value);
      }
      if (tags.length > PLACE_LIMITS.tags) return { error: `more than ${PLACE_LIMITS.tags} tags` };
      return { value: tags };
    }
    case 'images': {
      if (!Array.isArray(value)) return { error: 'images must be a list' };
      if (value.length > PLACE_LIMITS.images)
        return { error: `more than ${PLACE_LIMITS.images} images` };
      if (value.some((ref) => typeof ref !== 'string' || !IMAGE_REF.test(ref)))
        return { error: 'an image reference must be a plain file name' };
      return { value: [...new Set(value as string[])] };
    }
    case 'location': {
      if (value === null) return { value: null };
      if (typeof value !== 'object' || Array.isArray(value))
        return { error: 'location must have lat and lng' };
      const { lat, lng, ...rest } = value as Record<string, unknown>;
      if (Object.keys(rest).length) return { error: 'location has only lat and lng' };
      if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90)
        return { error: 'location lat must be between -90 and 90' };
      if (typeof lng !== 'number' || !Number.isFinite(lng) || lng < -180 || lng > 180)
        return { error: 'location lng must be between -180 and 180' };
      return { value: { lat, lng } };
    }
    case 'timeSpent':
      if (value === null) return { value: null };
      return typeof value === 'string' && Object.hasOwn(TIME_SPENT_VALUES, value)
        ? { value: value as TimeSpent }
        : { error: 'timeSpent must be 2h, half-day or full-day' };
  }
}

/** Validates a partial update: only known fields, each valid. An empty patch is valid. */
export function validatePlacePatch(input: unknown): Validation<PlacePatch> {
  if (typeof input !== 'object' || input === null || Array.isArray(input))
    return { ok: false, errors: ['a place must be an object'] };
  const errors: string[] = [];
  const value: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(input)) {
    if (!(FIELDS as readonly string[]).includes(key)) {
      errors.push(`unknown field ${key}`);
      continue;
    }
    const checked = checkField(key as keyof PlaceFields, raw);
    if ('error' in checked) errors.push(checked.error);
    else value[key] = checked.value;
  }
  return errors.length ? { ok: false, errors } : { ok: true, value: value as PlacePatch };
}

/** Validates a new place: a name is enough; missing fields take their empty values. */
export function validateNewPlace(input: unknown): Validation<PlaceFields> {
  const patch = validatePlacePatch(input);
  if (!patch.ok) return patch;
  if (patch.value.name === undefined) return { ok: false, errors: ['name is required'] };
  return { ok: true, value: { ...EMPTY, ...patch.value, name: patch.value.name } };
}
