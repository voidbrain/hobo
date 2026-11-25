import { strict as assert } from 'node:assert';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import type { Place } from '../src/app/core/place.ts';
import { startServer, type RunningServer } from './app.ts';

// Invented places only: no real names, addresses or coordinates of the owner.
describe('places API', () => {
  let dataDir: string;
  let server: RunningServer;
  const call = (path: string, init: RequestInit = {}) =>
    fetch(server.url + path, {
      ...init,
      headers: init.body ? { 'content-type': 'application/json', ...init.headers } : init.headers,
    });

  beforeEach(async () => {
    dataDir = join(mkdtempSync(join(tmpdir(), 'hobo-api-')), 'data');
    server = await startServer({ host: '127.0.0.1', port: 0, dataDir });
  });
  afterEach(async () => {
    await server.close();
    rmSync(join(dataDir, '..'), { recursive: true, force: true });
  });

  it('creates the data folder and a place with a name only', async () => {
    assert.ok(existsSync(join(dataDir, 'hobo.sqlite')));
    const res = await call('/api/places', { method: 'POST', body: JSON.stringify({ name: 'Lantern Hill' }) });
    assert.equal(res.status, 201);
    const place = (await res.json()) as Place;
    assert.equal(res.headers.get('location'), `/api/places/${place.id}`);
    assert.equal(place.name, 'Lantern Hill');
    assert.deepEqual(place.tags, []);
    assert.equal(place.timeSpent, null);
  });

  it('reads, lists, updates and deletes', async () => {
    const created = (await (
      await call('/api/places', { method: 'POST', body: JSON.stringify({ name: 'Old Mill Museum' }) })
    ).json()) as Place;

    const got = await call(`/api/places/${created.id}`);
    assert.equal(got.status, 200);
    assert.deepEqual(await got.json(), created);

    const patched = await call(`/api/places/${created.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ category: 'Museum', notes: 'Closed on Mondays', timeSpent: 'half-day' }),
    });
    assert.equal(patched.status, 200);
    const updated = (await patched.json()) as Place;
    assert.equal(updated.category, 'Museum');
    assert.equal(updated.timeSpent, 'half-day');

    const list = (await (await call('/api/places')).json()) as Place[];
    assert.deepEqual(list, [updated]);

    assert.equal((await call(`/api/places/${created.id}`, { method: 'DELETE' })).status, 204);
    assert.equal((await call(`/api/places/${created.id}`)).status, 404);
    assert.equal((await call(`/api/places/${created.id}`, { method: 'DELETE' })).status, 404);
    assert.equal(
      (await call(`/api/places/${created.id}`, { method: 'PATCH', body: JSON.stringify({ notes: 'x' }) })).status,
      404,
    );
  });

  it('rejects invalid places with every error', async () => {
    const res = await call('/api/places', {
      method: 'POST',
      body: JSON.stringify({ name: '', timeSpent: '3h' }),
    });
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), {
      errors: ['name is required', 'timeSpent must be 2h, half-day or full-day'],
    });
    const created = (await (
      await call('/api/places', { method: 'POST', body: JSON.stringify({ name: 'Quiet Bay' }) })
    ).json()) as Place;
    const bad = await call(`/api/places/${created.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ id: 'other', location: { lat: 100, lng: 0 } }),
    });
    assert.equal(bad.status, 400);
    assert.equal(((await bad.json()) as { errors: string[] }).errors.length, 2);
  });

  it('rejects bodies that are not JSON, too large, or sent without the JSON content type', async () => {
    assert.equal((await call('/api/places', { method: 'POST', body: '{nope' })).status, 400);
    const plain = await fetch(server.url + '/api/places', {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: JSON.stringify({ name: 'Lantern Hill' }),
    });
    assert.equal(plain.status, 415);
    const huge = JSON.stringify({ name: 'Lantern Hill', notes: 'x'.repeat(2_000_000) });
    assert.equal((await call('/api/places', { method: 'POST', body: huge })).status, 413);
    assert.deepEqual(await (await call('/api/places')).json(), []);
  });

  it('answers unknown paths and methods', async () => {
    assert.equal((await call('/api/nothing')).status, 404);
    assert.equal((await call('/api/places', { method: 'PUT' })).status, 405);
    assert.equal((await call('/api/places/some-id', { method: 'POST' })).status, 405);
  });

  it('refuses a request for another host name (DNS rebinding)', async () => {
    const { request } = await import('node:http');
    const status = await new Promise<number>((resolve, reject) => {
      const req = request(server.url + '/api/places', { headers: { host: 'evil.example' } }, (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      });
      req.on('error', reject);
      req.end();
    });
    assert.equal(status, 421);
  });

  it('keeps places across a server restart', async () => {
    const created = (await (
      await call('/api/places', {
        method: 'POST',
        body: JSON.stringify({ name: 'Quiet Bay', location: { lat: -33.5, lng: 151.25 }, tags: ['swim'] }),
      })
    ).json()) as Place;
    await server.close();
    server = await startServer({ host: '127.0.0.1', port: 0, dataDir });
    assert.deepEqual(await (await call('/api/places')).json(), [created]);
  });
});
