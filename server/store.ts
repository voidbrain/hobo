import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import type { Place, PlaceFields, PlacePatch } from '../src/app/core/place.ts';
import type {
  HoboSettings,
  Trip,
  TripDay,
  TripEndpoint,
  TripFields,
  TripPatch,
} from '../src/app/core/trip.ts';
import {
  toLegCacheColumns,
  type CachedLeg,
  type LegCache,
  type MapPoint,
  type TravelProfile,
} from '../src/app/maps/map-provider.ts';

/** Places, trips, settings and leg cache on the owner's machine. Input is validated by the caller. */
export interface PlaceStore extends LegCache {
  list(): Place[];
  get(id: string): Place | undefined;
  create(fields: PlaceFields): Place;
  update(id: string, patch: PlacePatch): Place | undefined;
  remove(id: string): boolean;
  getSettings(): HoboSettings;
  updateSettings(patch: Partial<HoboSettings>): HoboSettings;
  listTrips(): Trip[];
  getTrip(id: string): Trip | undefined;
  createTrip(fields: TripFields): Trip;
  updateTrip(id: string, patch: TripPatch): Trip | undefined;
  removeTrip(id: string): boolean;
  unknownPlaceIds(ids: readonly string[]): string[];
  close(): void;
}

// PRAGMA user_version records which of these have run; append a migration, never edit one.
const MIGRATIONS = [
  `CREATE TABLE places (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    images TEXT NOT NULL,
    category TEXT,
    tags TEXT NOT NULL,
    notes TEXT NOT NULL,
    lat REAL,
    lng REAL,
    time_spent TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT`,
  `CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  ) STRICT;
  CREATE TABLE trips (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    from_point TEXT,
    to_point TEXT,
    days TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  ) STRICT`,
  `CREATE TABLE leg_cache (
    provider TEXT NOT NULL,
    profile TEXT NOT NULL,
    from_key TEXT NOT NULL,
    to_key TEXT NOT NULL,
    from_lat REAL NOT NULL,
    from_lng REAL NOT NULL,
    to_lat REAL NOT NULL,
    to_lng REAL NOT NULL,
    distance_metres INTEGER NOT NULL,
    travel_minutes INTEGER NOT NULL,
    geometry TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (provider, profile, from_key, to_key)
  ) STRICT`,
];

interface PlaceRow {
  id: string;
  name: string;
  description: string;
  images: string;
  category: string | null;
  tags: string;
  notes: string;
  lat: number | null;
  lng: number | null;
  time_spent: string | null;
  created_at: string;
  updated_at: string;
}

interface TripRow {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  from_point: string | null;
  to_point: string | null;
  days: string;
  created_at: string;
  updated_at: string;
}

interface LegCacheRow {
  provider: string;
  profile: string;
  from_key: string;
  to_key: string;
  from_lat: number;
  from_lng: number;
  to_lat: number;
  to_lng: number;
  distance_metres: number;
  travel_minutes: number;
  geometry: string;
  updated_at: string;
}

const toPlace = (row: PlaceRow): Place => ({
  id: row.id,
  name: row.name,
  description: row.description,
  images: JSON.parse(row.images) as string[],
  category: row.category,
  tags: JSON.parse(row.tags) as string[],
  notes: row.notes,
  location: row.lat === null || row.lng === null ? null : { lat: row.lat, lng: row.lng },
  timeSpent: row.time_spent as Place['timeSpent'],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toPlaceParams = (p: Place) => ({
  id: p.id,
  name: p.name,
  description: p.description,
  images: JSON.stringify(p.images),
  category: p.category,
  tags: JSON.stringify(p.tags),
  notes: p.notes,
  lat: p.location?.lat ?? null,
  lng: p.location?.lng ?? null,
  time_spent: p.timeSpent,
  created_at: p.createdAt,
  updated_at: p.updatedAt,
});

const toTrip = (row: TripRow): Trip => ({
  id: row.id,
  name: row.name,
  startDate: row.start_date,
  endDate: row.end_date,
  from: row.from_point === null ? null : (JSON.parse(row.from_point) as TripEndpoint),
  to: row.to_point === null ? null : (JSON.parse(row.to_point) as TripEndpoint),
  days: JSON.parse(row.days) as TripDay[],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toTripParams = (t: Trip) => ({
  id: t.id,
  name: t.name,
  start_date: t.startDate,
  end_date: t.endDate,
  from_point: t.from === null ? null : JSON.stringify(t.from),
  to_point: t.to === null ? null : JSON.stringify(t.to),
  days: JSON.stringify(t.days),
  created_at: t.createdAt,
  updated_at: t.updatedAt,
});

const toCachedLeg = (row: LegCacheRow): CachedLeg => ({
  provider: row.provider,
  profile: row.profile as TravelProfile,
  fromKey: row.from_key,
  toKey: row.to_key,
  from: { lat: row.from_lat, lng: row.from_lng },
  to: { lat: row.to_lat, lng: row.to_lng },
  distanceMetres: row.distance_metres,
  travelMinutes: row.travel_minutes,
  geometry: JSON.parse(row.geometry) as MapPoint[],
  updatedAt: row.updated_at,
});

function nonNegativeWhole(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative number`);
  }
  return Math.round(value);
}

function stripPlaceFromEndpoint(ep: TripEndpoint | null, placeId: string): TripEndpoint | null {
  if (!ep || ep.placeId !== placeId) return ep;
  return { ...ep, placeId: null };
}

export function openPlaceStore(file: string, now = () => new Date().toISOString()): PlaceStore {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL');
  const { user_version: version } = db.prepare('PRAGMA user_version').get() as {
    user_version: number;
  };
  for (const [index, sql] of MIGRATIONS.entries()) {
    if (index < version) continue;
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.exec(`PRAGMA user_version = ${index + 1}`);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      db.close();
      throw error;
    }
  }
  const placeColumns =
    'id, name, description, images, category, tags, notes, lat, lng, time_spent, created_at, updated_at';
  const listAllPlaces = db.prepare(`SELECT ${placeColumns} FROM places ORDER BY rowid`);
  const getOnePlace = db.prepare(`SELECT ${placeColumns} FROM places WHERE id = ?`);
  const hasPlace = db.prepare('SELECT 1 FROM places WHERE id = ?');
  const insertPlace = db.prepare(
    `INSERT INTO places (${placeColumns}) VALUES (:id, :name, :description, :images, :category, :tags, :notes, :lat, :lng, :time_spent, :created_at, :updated_at)`,
  );
  const replacePlace = db.prepare(
    `UPDATE places SET name = :name, description = :description, images = :images, category = :category,
     tags = :tags, notes = :notes, lat = :lat, lng = :lng, time_spent = :time_spent, updated_at = :updated_at
     WHERE id = :id AND created_at = :created_at`,
  );
  const deleteOnePlace = db.prepare('DELETE FROM places WHERE id = ?');

  const getSetting = db.prepare('SELECT value FROM settings WHERE key = ?');
  const putSetting = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  );

  const tripColumns =
    'id, name, start_date, end_date, from_point, to_point, days, created_at, updated_at';
  const listAllTrips = db.prepare(`SELECT ${tripColumns} FROM trips ORDER BY rowid`);
  const getOneTrip = db.prepare(`SELECT ${tripColumns} FROM trips WHERE id = ?`);
  const insertTrip = db.prepare(
    `INSERT INTO trips (${tripColumns}) VALUES (:id, :name, :start_date, :end_date, :from_point, :to_point, :days, :created_at, :updated_at)`,
  );
  const replaceTrip = db.prepare(
    `UPDATE trips SET name = :name, start_date = :start_date, end_date = :end_date, from_point = :from_point,
     to_point = :to_point, days = :days, updated_at = :updated_at
     WHERE id = :id AND created_at = :created_at`,
  );
  const deleteOneTrip = db.prepare('DELETE FROM trips WHERE id = ?');

  const legColumns =
    'provider, profile, from_key, to_key, from_lat, from_lng, to_lat, to_lng, distance_metres, travel_minutes, geometry, updated_at';
  const getOneLeg = db.prepare(
    `SELECT ${legColumns} FROM leg_cache WHERE provider = ? AND profile = ? AND from_key = ? AND to_key = ?`,
  );
  const upsertLeg = db.prepare(
    `INSERT INTO leg_cache (${legColumns})
     VALUES (:provider, :profile, :from_key, :to_key, :from_lat, :from_lng, :to_lat, :to_lng, :distance_metres, :travel_minutes, :geometry, :updated_at)
     ON CONFLICT(provider, profile, from_key, to_key) DO UPDATE SET
       from_lat = excluded.from_lat,
       from_lng = excluded.from_lng,
       to_lat = excluded.to_lat,
       to_lng = excluded.to_lng,
       distance_metres = excluded.distance_metres,
       travel_minutes = excluded.travel_minutes,
       geometry = CASE WHEN excluded.geometry = '[]' THEN leg_cache.geometry ELSE excluded.geometry END,
       updated_at = excluded.updated_at`,
  );

  const get = (id: string) => {
    const row = getOnePlace.get(id) as PlaceRow | undefined;
    return row && toPlace(row);
  };

  const getSettings = (): HoboSettings => {
    const row = getSetting.get('home') as { value: string } | undefined;
    return { home: row ? (JSON.parse(row.value) as TripEndpoint | null) : null };
  };

  const getTrip = (id: string) => {
    const row = getOneTrip.get(id) as TripRow | undefined;
    return row && toTrip(row);
  };

  const getLeg: LegCache['getLeg'] = (provider, profile, from, to) => {
    const cols = toLegCacheColumns(provider, profile, from, to);
    const row = getOneLeg.get(cols.provider, cols.profile, cols.fromKey, cols.toKey) as
      LegCacheRow | undefined;
    return row && toCachedLeg(row);
  };

  return {
    list: () => (listAllPlaces.all() as unknown as PlaceRow[]).map(toPlace),
    get,
    create(fields) {
      const stamp = now();
      const place: Place = { ...fields, id: randomUUID(), createdAt: stamp, updatedAt: stamp };
      insertPlace.run(toPlaceParams(place));
      return place;
    },
    update(id, patch) {
      const current = get(id);
      if (!current) return undefined;
      const place: Place = { ...current, ...patch, id, updatedAt: now() };
      replacePlace.run(toPlaceParams(place));
      return place;
    },
    remove(id) {
      db.exec('BEGIN');
      try {
        const deleted = deleteOnePlace.run(id).changes > 0;
        if (deleted) {
          const settings = getSettings();
          if (settings.home?.placeId === id) {
            putSetting.run('home', JSON.stringify(stripPlaceFromEndpoint(settings.home, id)));
          }
          const stamp = now();
          for (const row of listAllTrips.all() as unknown as TripRow[]) {
            const trip = toTrip(row);
            const nextFrom = stripPlaceFromEndpoint(trip.from, id);
            const nextTo = stripPlaceFromEndpoint(trip.to, id);
            const stopPresent = trip.days.some((d) => d.stops.includes(id));
            if (nextFrom !== trip.from || nextTo !== trip.to || stopPresent) {
              const cleaned: Trip = {
                ...trip,
                from: nextFrom,
                to: nextTo,
                days: trip.days.map((d) => ({
                  date: d.date,
                  stops: d.stops.filter((s) => s !== id),
                })),
                updatedAt: stamp,
              };
              replaceTrip.run(toTripParams(cleaned));
            }
          }
        }
        db.exec('COMMIT');
        return deleted;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    getSettings,
    updateSettings(patch) {
      if ('home' in patch) {
        putSetting.run('home', JSON.stringify(patch.home ?? null));
      }
      return getSettings();
    },
    listTrips: () => (listAllTrips.all() as unknown as TripRow[]).map(toTrip),
    getTrip,
    createTrip(fields) {
      const stamp = now();
      const trip: Trip = { ...fields, id: randomUUID(), createdAt: stamp, updatedAt: stamp };
      insertTrip.run(toTripParams(trip));
      return trip;
    },
    updateTrip(id, patch) {
      const current = getTrip(id);
      if (!current) return undefined;
      const trip: Trip = { ...current, ...patch, id, updatedAt: now() };
      replaceTrip.run(toTripParams(trip));
      return trip;
    },
    removeTrip: (id) => deleteOneTrip.run(id).changes > 0,
    unknownPlaceIds: (ids) => ids.filter((id) => !hasPlace.get(id)),
    getLeg,
    putLeg(entry) {
      const cols = toLegCacheColumns(entry.provider, entry.profile, entry.from, entry.to);
      const stamp = now();
      const geometry = entry.geometry ? [...entry.geometry] : [];
      upsertLeg.run({
        provider: cols.provider,
        profile: cols.profile,
        from_key: cols.fromKey,
        to_key: cols.toKey,
        from_lat: entry.from.lat,
        from_lng: entry.from.lng,
        to_lat: entry.to.lat,
        to_lng: entry.to.lng,
        distance_metres: nonNegativeWhole(entry.distanceMetres, 'distanceMetres'),
        travel_minutes: nonNegativeWhole(entry.travelMinutes, 'travelMinutes'),
        geometry: JSON.stringify(geometry),
        updated_at: stamp,
      });
      return getLeg(cols.provider, cols.profile, entry.from, entry.to)!;
    },
    close: () => db.close(),
  };
}
