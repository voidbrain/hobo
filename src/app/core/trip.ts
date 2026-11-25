// Framework-free domain code: no Angular imports (eslint and check:conventions enforce it).
// The server (server/) imports this file under Node's type stripping, so its only relative import is type-only.
import type { GeoPoint, Validation } from './place';

/** Start or end point of a trip (for example home in settings, an ad-hoc point, or a saved place). */
export interface TripEndpoint {
  name: string;
  location: GeoPoint | null;
  placeId: string | null;
}

/** Local owner settings persisted in SQLite. */
export interface HoboSettings {
  home: TripEndpoint | null;
}

/** One calendar day of a trip and its ordered stop place IDs. */
export interface TripDay {
  date: string;
  stops: string[];
}

/** User-editable fields of a trip. */
export interface TripFields {
  name: string;
  startDate: string;
  endDate: string;
  from: TripEndpoint | null;
  to: TripEndpoint | null;
  days: TripDay[];
}

/** A stored trip with store-assigned identity and timestamps. */
export interface Trip extends TripFields {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export type TripPatch = Partial<TripFields>;

export interface NewTripInput {
  name: string;
  startDate: string;
  endDate: string;
  from?: Partial<TripEndpoint> | null;
  to?: Partial<TripEndpoint> | null;
  days?: TripDay[];
}

export const TRIP_LIMITS = {
  name: 200,
  endpointName: 200,
  placeId: 128,
  maxDays: 366,
  stopsPerDay: 100,
} as const;

const TRIP_KEYS = ['name', 'startDate', 'endDate', 'from', 'to', 'days'] as const;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

function parseIsoDateUtc(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const m = ISO_DATE.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const utc = Date.UTC(year, month - 1, day);
  const check = new Date(utc);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return utc;
}

function formatUtcDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Every `YYYY-MM-DD` calendar date from `startDate` through `endDate` inclusive, or `[]` when invalid. */
export function datesBetween(startDate: string, endDate: string): string[] {
  const start = parseIsoDateUtc(startDate);
  const end = parseIsoDateUtc(endDate);
  if (start === null || end === null || end < start) return [];
  const count = Math.round((end - start) / MS_PER_DAY) + 1;
  if (count > TRIP_LIMITS.maxDays) return [];
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(formatUtcDate(start + i * MS_PER_DAY));
  }
  return out;
}

/** Builds one `TripDay` per calendar date in `[startDate..endDate]`, keeping stops on matching dates. */
export function reconcileTripDays(
  startDate: string,
  endDate: string,
  existingDays: readonly TripDay[] = [],
): TripDay[] {
  const byDate = new Map<string, string[]>();
  for (const day of existingDays) {
    byDate.set(day.date, [...day.stops]);
  }
  return datesBetween(startDate, endDate).map((date) => ({
    date,
    stops: byDate.get(date) ?? [],
  }));
}

/** Pure helper: appends `placeId` (or inserts at `index`) on `date`. */
export function addTripStop(
  days: readonly TripDay[],
  date: string,
  placeId: string,
  index?: number,
): TripDay[] {
  return days.map((day) => {
    if (day.date !== date) return { date: day.date, stops: [...day.stops] };
    const stops = [...day.stops];
    const at =
      index === undefined ? stops.length : Math.max(0, Math.min(stops.length, Math.trunc(index)));
    stops.splice(at, 0, placeId);
    return { date: day.date, stops };
  });
}

/** Pure helper: removes the stop at `index` on `date`. */
export function removeTripStop(days: readonly TripDay[], date: string, index: number): TripDay[] {
  return days.map((day) => {
    if (day.date !== date) return { date: day.date, stops: [...day.stops] };
    if (index < 0 || index >= day.stops.length) return { date: day.date, stops: [...day.stops] };
    const stops = [...day.stops];
    stops.splice(index, 1);
    return { date: day.date, stops };
  });
}

/** Pure helper: moves a stop within a day or between days. */
export function moveTripStop(
  days: readonly TripDay[],
  fromDate: string,
  fromIndex: number,
  toDate: string,
  toIndex: number,
): TripDay[] {
  const sourceDay = days.find((d) => d.date === fromDate);
  const targetExists = days.some((d) => d.date === toDate);
  if (!sourceDay || !targetExists || fromIndex < 0 || fromIndex >= sourceDay.stops.length) {
    return days.map((d) => ({ date: d.date, stops: [...d.stops] }));
  }
  const placeId = sourceDay.stops[fromIndex];
  const removed = removeTripStop(days, fromDate, fromIndex);
  return addTripStop(removed, toDate, placeId, toIndex);
}

/** Distinct place IDs referenced by `from`, `to` and all `days[].stops` of a trip. */
export function tripPlaceIds(trip: Pick<TripFields, 'from' | 'to' | 'days'>): string[] {
  const out: string[] = [];
  const push = (id: string | null | undefined) => {
    if (id && !out.includes(id)) out.push(id);
  };
  push(trip.from?.placeId);
  push(trip.to?.placeId);
  for (const day of trip.days) {
    for (const stop of day.stops) push(stop);
  }
  return out;
}

type Checked<T> = { value: T } | { error: string };

function checkName(value: unknown, field: string, max: number): Checked<string> {
  if (typeof value !== 'string') return { error: `${field} must be text` };
  const trimmed = value.trim();
  if (!trimmed) return { error: `${field} is required` };
  if (trimmed.length > max) return { error: `${field} is longer than ${max} characters` };
  return { value: trimmed };
}

function checkLocation(value: unknown, field: string): Checked<GeoPoint | null> {
  if (value === undefined || value === null) return { value: null };
  if (typeof value !== 'object' || Array.isArray(value)) {
    return { error: `${field} location must have lat and lng` };
  }
  const { lat, lng, ...rest } = value as Record<string, unknown>;
  if (Object.keys(rest).length) return { error: `${field} location has only lat and lng` };
  if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90) {
    return { error: `${field} location lat must be between -90 and 90` };
  }
  if (typeof lng !== 'number' || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    return { error: `${field} location lng must be between -180 and 180` };
  }
  return { value: { lat, lng } };
}

function checkPlaceRef(value: unknown, field: string): Checked<string> {
  if (typeof value !== 'string') return { error: `${field} must be a place id` };
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > TRIP_LIMITS.placeId) {
    return { error: `${field} must be a non-empty place id` };
  }
  return { value: trimmed };
}

function checkEndpoint(value: unknown, field: string): Checked<TripEndpoint | null> {
  if (value === null) return { value: null };
  if (typeof value !== 'object' || Array.isArray(value)) {
    return { error: `${field} must be an endpoint or null` };
  }
  const raw = value as Record<string, unknown>;
  for (const key of Object.keys(raw)) {
    if (key !== 'name' && key !== 'location' && key !== 'placeId') {
      return { error: `${field} has unknown field ${key}` };
    }
  }
  const name = checkName(raw['name'], `${field} name`, TRIP_LIMITS.endpointName);
  if ('error' in name) return name;
  const loc = checkLocation(raw['location'], field);
  if ('error' in loc) return loc;
  let placeId: string | null = null;
  if (raw['placeId'] !== undefined && raw['placeId'] !== null) {
    const ref = checkPlaceRef(raw['placeId'], `${field} placeId`);
    if ('error' in ref) return ref;
    placeId = ref.value;
  }
  return { value: { name: name.value, location: loc.value, placeId } };
}

function checkDays(value: unknown, expectedDates: readonly string[]): Checked<TripDay[]> {
  if (!Array.isArray(value)) return { error: 'days must be a list' };
  if (value.length !== expectedDates.length) {
    return { error: 'days must list each date from startDate to endDate in order' };
  }
  const days: TripDay[] = [];
  for (let i = 0; i < value.length; i++) {
    const raw = value[i];
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      return { error: 'each day must be an object with date and stops' };
    }
    const obj = raw as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      if (key !== 'date' && key !== 'stops') return { error: `day has unknown field ${key}` };
    }
    if (obj['date'] !== expectedDates[i]) {
      return { error: 'days must list each date from startDate to endDate in order' };
    }
    if (!Array.isArray(obj['stops'])) return { error: 'day stops must be a list of place ids' };
    if (obj['stops'].length > TRIP_LIMITS.stopsPerDay) {
      return { error: `more than ${TRIP_LIMITS.stopsPerDay} stops on ${expectedDates[i]}` };
    }
    const stops: string[] = [];
    for (const stop of obj['stops']) {
      const ref = checkPlaceRef(stop, 'a stop');
      if ('error' in ref) return ref;
      stops.push(ref.value);
    }
    days.push({ date: expectedDates[i], stops });
  }
  return { value: days };
}

function cloneEndpoint(ep: TripEndpoint | null): TripEndpoint | null {
  return ep
    ? {
        name: ep.name,
        location: ep.location ? { lat: ep.location.lat, lng: ep.location.lng } : null,
        placeId: ep.placeId,
      }
    : null;
}

/** Validates a partial update to local settings (`{ home }`). */
export function validateSettingsPatch(input: unknown): Validation<Partial<HoboSettings>> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, errors: ['settings must be an object'] };
  }
  const errors: string[] = [];
  const value: Partial<HoboSettings> = {};
  for (const [key, raw] of Object.entries(input)) {
    if (key !== 'home') {
      errors.push(`unknown field ${key}`);
      continue;
    }
    const checked = checkEndpoint(raw, 'home');
    if ('error' in checked) errors.push(checked.error);
    else value.home = checked.value;
  }
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

/** Validates a new trip, defaulting omitted `from` and `to` to `home`. */
export function validateNewTrip(
  input: unknown,
  home: TripEndpoint | null = null,
): Validation<TripFields> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, errors: ['a trip must be an object'] };
  }
  const raw = input as Record<string, unknown>;
  const errors: string[] = [];
  for (const key of Object.keys(raw)) {
    if (!(TRIP_KEYS as readonly string[]).includes(key)) {
      errors.push(`unknown field ${key}`);
    }
  }
  const name =
    raw['name'] === undefined
      ? { error: 'name is required' }
      : checkName(raw['name'], 'name', TRIP_LIMITS.name);
  if ('error' in name) errors.push(name.error);

  const startMs = parseIsoDateUtc(raw['startDate']);
  if (startMs === null) errors.push('startDate must be a valid YYYY-MM-DD date');
  const endMs = parseIsoDateUtc(raw['endDate']);
  if (endMs === null) errors.push('endDate must be a valid YYYY-MM-DD date');

  let expectedDates: string[] = [];
  if (startMs !== null && endMs !== null) {
    if (endMs < startMs) {
      errors.push('endDate must not be before startDate');
    } else if (Math.round((endMs - startMs) / MS_PER_DAY) + 1 > TRIP_LIMITS.maxDays) {
      errors.push(`a trip cannot span more than ${TRIP_LIMITS.maxDays} days`);
    } else {
      expectedDates = datesBetween(raw['startDate'] as string, raw['endDate'] as string);
    }
  }

  let fromValue: TripEndpoint | null = cloneEndpoint(home);
  if ('from' in raw && raw['from'] !== undefined) {
    const checked = checkEndpoint(raw['from'], 'from');
    if ('error' in checked) errors.push(checked.error);
    else fromValue = checked.value;
  }

  let toValue: TripEndpoint | null = cloneEndpoint(home);
  if ('to' in raw && raw['to'] !== undefined) {
    const checked = checkEndpoint(raw['to'], 'to');
    if ('error' in checked) errors.push(checked.error);
    else toValue = checked.value;
  }

  let daysValue: TripDay[] = [];
  if (expectedDates.length > 0) {
    if ('days' in raw && raw['days'] !== undefined) {
      const checked = checkDays(raw['days'], expectedDates);
      if ('error' in checked) errors.push(checked.error);
      else daysValue = checked.value;
    } else {
      daysValue = reconcileTripDays(raw['startDate'] as string, raw['endDate'] as string);
    }
  }

  if (errors.length || 'error' in name) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name: name.value,
      startDate: raw['startDate'] as string,
      endDate: raw['endDate'] as string,
      from: fromValue,
      to: toValue,
      days: daysValue,
    },
  };
}

/** Validates a partial update against an existing trip's dates and days. */
export function validateTripPatch(
  input: unknown,
  current: Pick<TripFields, 'startDate' | 'endDate' | 'days'>,
): Validation<TripPatch> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, errors: ['a trip must be an object'] };
  }
  const raw = input as Record<string, unknown>;
  const errors: string[] = [];
  const patch: TripPatch = {};

  for (const key of Object.keys(raw)) {
    if (!(TRIP_KEYS as readonly string[]).includes(key)) {
      errors.push(`unknown field ${key}`);
    }
  }

  if ('name' in raw) {
    const name = checkName(raw['name'], 'name', TRIP_LIMITS.name);
    if ('error' in name) errors.push(name.error);
    else patch.name = name.value;
  }

  let nextStart = current.startDate;
  if ('startDate' in raw) {
    if (parseIsoDateUtc(raw['startDate']) === null) {
      errors.push('startDate must be a valid YYYY-MM-DD date');
    } else {
      nextStart = raw['startDate'] as string;
      patch.startDate = nextStart;
    }
  }

  let nextEnd = current.endDate;
  if ('endDate' in raw) {
    if (parseIsoDateUtc(raw['endDate']) === null) {
      errors.push('endDate must be a valid YYYY-MM-DD date');
    } else {
      nextEnd = raw['endDate'] as string;
      patch.endDate = nextEnd;
    }
  }

  const startMs = parseIsoDateUtc(nextStart);
  const endMs = parseIsoDateUtc(nextEnd);
  let expectedDates: string[] = [];
  if (startMs !== null && endMs !== null) {
    if (endMs < startMs) {
      errors.push('endDate must not be before startDate');
    } else if (Math.round((endMs - startMs) / MS_PER_DAY) + 1 > TRIP_LIMITS.maxDays) {
      errors.push(`a trip cannot span more than ${TRIP_LIMITS.maxDays} days`);
    } else {
      expectedDates = datesBetween(nextStart, nextEnd);
    }
  }

  if ('from' in raw) {
    const checked = checkEndpoint(raw['from'], 'from');
    if ('error' in checked) errors.push(checked.error);
    else patch.from = checked.value;
  }

  if ('to' in raw) {
    const checked = checkEndpoint(raw['to'], 'to');
    if ('error' in checked) errors.push(checked.error);
    else patch.to = checked.value;
  }

  if (expectedDates.length > 0) {
    if ('days' in raw && raw['days'] !== undefined) {
      const checked = checkDays(raw['days'], expectedDates);
      if ('error' in checked) errors.push(checked.error);
      else patch.days = checked.value;
    } else if ('startDate' in raw || 'endDate' in raw) {
      patch.days = reconcileTripDays(nextStart, nextEnd, current.days);
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true, value: patch };
}
