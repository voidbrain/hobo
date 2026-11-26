import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
  DEFAULT_OSM_TILES,
  type MapPoint,
  type MapProvider,
} from '../src/app/maps/map-provider.ts';
import { loadConfig } from './config.ts';
import { createServerMapProvider } from './map-adapter.ts';
import { openPlaceStore } from './store.ts';

const HARBOUR: MapPoint = { lat: 44.41, lng: 8.93 };
const RIDGE: MapPoint = { lat: 44.55, lng: 9.12 };

describe('SQLite leg cache and server map adapter (F-007-T01)', () => {
  let dir: string;
  beforeEach(() => (dir = mkdtempSync(join(tmpdir(), 'hobo-legs-'))));
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('persists cached legs in SQLite keyed by provider, profile, from and to across store restarts', () => {
    const dbFile = join(dir, 'hobo.sqlite');
    let clock = '2026-11-26T07:10:00.000Z';
    const store = openPlaceStore(dbFile, () => clock);

    const saved = store.putLeg({
      provider: 'openrouteservice',
      profile: 'driving-car',
      from: HARBOUR,
      to: RIDGE,
      distanceMetres: 28_400.4,
      travelMinutes: 34.6,
      geometry: [HARBOUR, { lat: 44.48, lng: 9.01 }, RIDGE],
    });
    assert.equal(saved.distanceMetres, 28_400);
    assert.equal(saved.travelMinutes, 35);
    assert.equal(saved.updatedAt, '2026-11-26T07:10:00.000Z');
    assert.equal(saved.geometry.length, 3);

    // Direction, profile and provider stay distinct
    assert.equal(store.getLeg('openrouteservice', 'driving-car', RIDGE, HARBOUR), undefined);
    assert.equal(store.getLeg('openrouteservice', 'foot-walking', HARBOUR, RIDGE), undefined);
    assert.equal(store.getLeg('osrm', 'driving-car', HARBOUR, RIDGE), undefined);

    // Upsert with empty geometry (e.g. from matrix) preserves previously cached route geometry
    clock = '2026-11-26T07:15:00.000Z';
    store.putLeg({
      provider: 'openrouteservice',
      profile: 'driving-car',
      from: HARBOUR,
      to: RIDGE,
      distanceMetres: 28_410,
      travelMinutes: 35,
      geometry: [],
    });
    store.close();

    const reopened = openPlaceStore(dbFile);
    try {
      const hit = reopened.getLeg('openrouteservice', 'driving-car', HARBOUR, RIDGE);
      assert.ok(hit);
      assert.equal(hit.distanceMetres, 28_410);
      assert.equal(hit.travelMinutes, 35);
      assert.equal(hit.geometry.length, 3);
      assert.equal(hit.updatedAt, '2026-11-26T07:15:00.000Z');
    } finally {
      reopened.close();
    }
  });

  it('wires the configured server provider through the SQLite leg cache so legs are fetched once', async () => {
    const store = openPlaceStore(join(dir, 'hobo.sqlite'));
    try {
      const config = loadConfig(dir, { HOBO_ORS_API_KEY: 'fixture-key' });
      let routeCalls = 0;
      const fakeOrs: MapProvider = {
        id: 'openrouteservice',
        tiles: DEFAULT_OSM_TILES,
        async route(req) {
          routeCalls++;
          return {
            provider: 'openrouteservice',
            profile: req.profile ?? 'driving-car',
            from: req.from,
            to: req.to,
            distanceMetres: 28_400,
            travelMinutes: 35,
            geometry: [req.from, req.to],
          };
        },
        async matrix(req) {
          return {
            provider: 'openrouteservice',
            profile: req.profile ?? 'driving-car',
            points: req.points,
            cells: [],
          };
        },
        async geocode() {
          return [];
        },
        async autocomplete() {
          return [];
        },
      };

      const adapter = createServerMapProvider(config, store, {
        openrouteservice: () => fakeOrs,
      });

      const first = await adapter.route({ from: HARBOUR, to: RIDGE });
      assert.equal(first.cached, false);
      assert.equal(routeCalls, 1);

      const second = await adapter.route({ from: HARBOUR, to: RIDGE });
      assert.equal(second.cached, true);
      assert.equal(routeCalls, 1);

      assert.throws(() => createServerMapProvider(config, store, {}), /openrouteservice/);
    } finally {
      store.close();
    }
  });
});
