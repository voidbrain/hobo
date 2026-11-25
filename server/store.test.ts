import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { validateNewPlace } from '../src/app/core/place.ts';
import { openPlaceStore } from './store.ts';

// Invented places only: no real names, addresses or coordinates of the owner.
const newPlace = (input: unknown) => {
  const result = validateNewPlace(input);
  assert.ok(result.ok);
  return result.value;
};

describe('place store', () => {
  let dir: string;
  beforeEach(() => (dir = mkdtempSync(join(tmpdir(), 'hobo-store-'))));
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('creates, reads, updates and deletes a place', () => {
    let tick = 0;
    const store = openPlaceStore(
      join(dir, 'hobo.sqlite'),
      () => `2026-01-01T00:00:0${tick++}.000Z`,
    );
    const created = store.create(newPlace({ name: 'Lantern Hill' }));
    assert.match(created.id, /^[0-9a-f-]{36}$/);
    assert.equal(created.name, 'Lantern Hill');
    assert.equal(created.createdAt, '2026-01-01T00:00:00.000Z');
    assert.deepEqual(store.get(created.id), created);

    const updated = store.update(created.id, {
      category: 'Viewpoint',
      tags: ['sunset'],
      location: { lat: 10.5, lng: 20.25 },
      timeSpent: '2h',
      images: ['hill-1.jpg'],
    });
    assert.ok(updated);
    assert.equal(updated.name, 'Lantern Hill');
    assert.deepEqual(updated.location, { lat: 10.5, lng: 20.25 });
    assert.deepEqual(updated.tags, ['sunset']);
    assert.deepEqual(updated.images, ['hill-1.jpg']);
    assert.equal(updated.timeSpent, '2h');
    assert.equal(updated.createdAt, created.createdAt);
    assert.equal(updated.updatedAt, '2026-01-01T00:00:01.000Z');
    assert.deepEqual(store.get(created.id), updated);

    assert.equal(store.update(created.id, { location: null })?.location, null);
    assert.equal(store.remove(created.id), true);
    assert.equal(store.get(created.id), undefined);
    assert.equal(store.remove(created.id), false);
    assert.equal(store.update(created.id, { notes: 'gone' }), undefined);
    store.close();
  });

  it('lists places in the order they were added', () => {
    const store = openPlaceStore(join(dir, 'hobo.sqlite'));
    for (const name of ['Old Mill Museum', 'Lantern Hill', 'Quiet Bay'])
      store.create(newPlace({ name }));
    assert.deepEqual(
      store.list().map((p) => p.name),
      ['Old Mill Museum', 'Lantern Hill', 'Quiet Bay'],
    );
    store.close();
  });

  it('keeps places after the store is closed and opened again', () => {
    const file = join(dir, 'hobo.sqlite');
    const first = openPlaceStore(file);
    const place = first.create(
      newPlace({ name: 'Quiet Bay', tags: ['swim'], timeSpent: 'full-day' }),
    );
    first.close();
    const second = openPlaceStore(file);
    assert.deepEqual(second.list(), [place]);
    second.close();
  });
});
