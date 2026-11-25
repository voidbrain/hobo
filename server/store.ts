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

/** Places, trips and settings on the owner's machine. Input is validated by the caller. */
export interface PlaceStore {
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
    close: () => db.close(),
  };
}
