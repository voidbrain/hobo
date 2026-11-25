import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import type { Place, PlaceFields, PlacePatch } from '../src/app/core/place.ts';

/** Places on the owner's machine. Input is validated by the caller (validateNewPlace, validatePlacePatch). */
export interface PlaceStore {
  list(): Place[];
  get(id: string): Place | undefined;
  create(fields: PlaceFields): Place;
  update(id: string, patch: PlacePatch): Place | undefined;
  remove(id: string): boolean;
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
];

interface Row {
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

const toPlace = (row: Row): Place => ({
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

const toParams = (p: Place) => ({
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

export function openPlaceStore(file: string, now = () => new Date().toISOString()): PlaceStore {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL');
  const { user_version: version } = db.prepare('PRAGMA user_version').get() as {
    user_version: number;
  };
  for (const [index, sql] of MIGRATIONS.entries()) {
    if (index < version) continue;
    db.exec('BEGIN');
    db.exec(sql);
    db.exec(`PRAGMA user_version = ${index + 1}`);
    db.exec('COMMIT');
  }
  const columns =
    'id, name, description, images, category, tags, notes, lat, lng, time_spent, created_at, updated_at';
  const listAll = db.prepare(`SELECT ${columns} FROM places ORDER BY rowid`);
  const getOne = db.prepare(`SELECT ${columns} FROM places WHERE id = ?`);
  const insert = db.prepare(
    `INSERT INTO places (${columns}) VALUES (:id, :name, :description, :images, :category, :tags, :notes, :lat, :lng, :time_spent, :created_at, :updated_at)`,
  );
  const replace = db.prepare(
    `UPDATE places SET name = :name, description = :description, images = :images, category = :category,
     tags = :tags, notes = :notes, lat = :lat, lng = :lng, time_spent = :time_spent, updated_at = :updated_at
     WHERE id = :id AND created_at = :created_at`,
  );
  const deleteOne = db.prepare('DELETE FROM places WHERE id = ?');
  const get = (id: string) => {
    const row = getOne.get(id) as Row | undefined;
    return row && toPlace(row);
  };

  return {
    list: () => (listAll.all() as unknown as Row[]).map(toPlace),
    get,
    create(fields) {
      const stamp = now();
      const place: Place = { ...fields, id: randomUUID(), createdAt: stamp, updatedAt: stamp };
      insert.run(toParams(place));
      return place;
    },
    update(id, patch) {
      const current = get(id);
      if (!current) return undefined;
      const place: Place = { ...current, ...patch, id, updatedAt: now() };
      replace.run(toParams(place));
      return place;
    },
    remove: (id) => deleteOne.run(id).changes > 0,
    close: () => db.close(),
  };
}
