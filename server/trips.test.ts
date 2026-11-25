import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import type { Place } from '../src/app/core/place.ts';
import type { HoboSettings, Trip } from '../src/app/core/trip.ts';
import { startServer, type RunningServer } from './app.ts';

// Invented places, home and trips only: no real names, addresses or coordinates of the owner.
describe('trips and settings API (F-003-T01)', () => {
  let dataDir: string;
  let server: RunningServer;
  const call = (path: string, init: RequestInit = {}) =>
    fetch(server.url + path, {
      ...init,
      headers: init.body ? { 'content-type': 'application/json', ...init.headers } : init.headers,
    });

  beforeEach(async () => {
    dataDir = join(mkdtempSync(join(tmpdir(), 'hobo-trips-')), 'data');
    server = await startServer({ host: '127.0.0.1', port: 0, dataDir });
  });
  afterEach(async () => {
    await server.close();
    rmSync(join(dataDir, '..'), { recursive: true, force: true });
  });

  it('stores home in settings and defaults trip from/to to home unless overridden', async () => {
    assert.deepEqual(await (await call('/api/settings')).json(), { home: null });

    const setRes = await call('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify({
        home: { name: 'Harbour Base', location: { lat: -33.86, lng: 151.21 } },
      }),
    });
    assert.equal(setRes.status, 200);
    const settings = (await setRes.json()) as HoboSettings;
    assert.deepEqual(settings.home, {
      name: 'Harbour Base',
      location: { lat: -33.86, lng: 151.21 },
      placeId: null,
    });

    const createdRes = await call('/api/trips', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Ridge Weekend',
        startDate: '2026-09-05',
        endDate: '2026-09-06',
      }),
    });
    assert.equal(createdRes.status, 201);
    const trip = (await createdRes.json()) as Trip;
    assert.equal(createdRes.headers.get('location'), `/api/trips/${trip.id}`);
    assert.deepEqual(trip.from, settings.home);
    assert.deepEqual(trip.to, settings.home);
    assert.deepEqual(trip.days, [
      { date: '2026-09-05', stops: [] },
      { date: '2026-09-06', stops: [] },
    ]);

    const customRes = await call('/api/trips', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Ferry Crossing',
        startDate: '2026-09-10',
        endDate: '2026-09-10',
        from: { name: 'North Wharf', location: { lat: -33.8, lng: 151.2 } },
        to: null,
      }),
    });
    assert.equal(customRes.status, 201);
    const custom = (await customRes.json()) as Trip;
    assert.equal(custom.from?.name, 'North Wharf');
    assert.equal(custom.to, null);
  });

  it('persists stops per day referencing places, rejects unknown places, and survives restarts', async () => {
    const p1 = (await (
      await call('/api/places', { method: 'POST', body: JSON.stringify({ name: 'Lantern Hill' }) })
    ).json()) as Place;
    const p2 = (await (
      await call('/api/places', { method: 'POST', body: JSON.stringify({ name: 'Quiet Bay' }) })
    ).json()) as Place;

    const badRef = await call('/api/trips', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Bad Stop',
        startDate: '2026-10-01',
        endDate: '2026-10-01',
        days: [{ date: '2026-10-01', stops: ['missing-place'] }],
      }),
    });
    assert.equal(badRef.status, 400);

    const created = (await (
      await call('/api/trips', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Bay Trail',
          startDate: '2026-10-01',
          endDate: '2026-10-02',
          days: [
            { date: '2026-10-01', stops: [p1.id, p2.id] },
            { date: '2026-10-02', stops: [] },
          ],
        }),
      })
    ).json()) as Trip;

    const patchedRes = await call(`/api/trips/${created.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ endDate: '2026-10-03' }),
    });
    assert.equal(patchedRes.status, 200);
    const patched = (await patchedRes.json()) as Trip;
    assert.deepEqual(patched.days, [
      { date: '2026-10-01', stops: [p1.id, p2.id] },
      { date: '2026-10-02', stops: [] },
      { date: '2026-10-03', stops: [] },
    ]);

    // Deleting a place removes dangling references from stored trip stops.
    assert.equal((await call(`/api/places/${p1.id}`, { method: 'DELETE' })).status, 204);
    const afterPlaceDelete = (await (await call(`/api/trips/${created.id}`)).json()) as Trip;
    assert.deepEqual(afterPlaceDelete.days[0]?.stops, [p2.id]);

    // Restart persistence
    await server.close();
    server = await startServer({ host: '127.0.0.1', port: 0, dataDir });
    const listed = (await (await call('/api/trips')).json()) as Trip[];
    assert.deepEqual(listed, [afterPlaceDelete]);

    // Malformed URI & delete lifecycle
    assert.equal((await call('/api/trips/%E0')).status, 404);
    assert.equal((await call(`/api/trips/${created.id}`, { method: 'DELETE' })).status, 204);
    assert.equal((await call(`/api/trips/${created.id}`)).status, 404);
  });
});
