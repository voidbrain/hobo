import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_OSM_TILES,
  DEFAULT_TRAVEL_PROFILE,
  TRAVEL_PROFILES,
  cachedMapProvider,
  createMemoryLegCache,
  formatPointKey,
  legCacheKey,
  toLegCacheColumns,
  validateGeocodeRequest,
  validateMatrixRequest,
  validateRouteRequest,
  type GeocodeCandidate,
  type MapPoint,
  type MapProvider,
  type MatrixResult,
  type RouteResult,
} from './map-provider';

const NORTHGATE: MapPoint = { lat: 45.1234564, lng: 9.6543214 };
const RIVERFORD: MapPoint = { lat: 45.223456, lng: 9.754321 };
const OAKRIDGE: MapPoint = { lat: 45.323456, lng: 9.854321 };

function makeStubProvider(overrides: Partial<MapProvider> = {}) {
  const route = vi.fn<MapProvider['route']>(async (req) => ({
    provider: 'openrouteservice',
    profile: req.profile ?? DEFAULT_TRAVEL_PROFILE,
    from: req.from,
    to: req.to,
    distanceMetres: 14_250,
    travelMinutes: 19,
    geometry: [req.from, { lat: 45.18, lng: 9.7 }, req.to],
  }));

  const matrix = vi.fn<MapProvider['matrix']>(async (req) => {
    const profile = req.profile ?? DEFAULT_TRAVEL_PROFILE;
    const cells = [];
    for (let i = 0; i < req.points.length; i++) {
      for (let j = 0; j < req.points.length; j++) {
        cells.push({
          fromIndex: i,
          toIndex: j,
          distanceMetres: i === j ? 0 : (i + 1) * 5_000 + (j + 1) * 1_000,
          travelMinutes: i === j ? 0 : (i + 1) * 6 + (j + 1) * 2,
        });
      }
    }
    return {
      provider: 'openrouteservice',
      profile,
      points: req.points,
      cells,
    } satisfies MatrixResult;
  });

  const geocode = vi.fn<MapProvider['geocode']>(async () => [
    {
      label: 'Northgate Square',
      location: NORTHGATE,
      country: 'Inventedland',
      region: 'North Shire',
      locality: 'Northgate',
    } satisfies GeocodeCandidate,
  ]);

  const autocomplete = vi.fn<MapProvider['autocomplete']>(async () => [
    {
      label: 'Northgate Station',
      location: NORTHGATE,
      country: 'Inventedland',
      region: null,
      locality: 'Northgate',
    } satisfies GeocodeCandidate,
  ]);

  const provider: MapProvider = {
    id: 'openrouteservice',
    tiles: DEFAULT_OSM_TILES,
    route,
    matrix,
    geocode,
    autocomplete,
    ...overrides,
  };

  return { provider, spies: { route, matrix, geocode, autocomplete } };
}

describe('map-provider keys and validation (F-007-T01)', () => {
  it('exposes standard travel profiles and OpenStreetMap tile defaults', () => {
    expect(TRAVEL_PROFILES).toEqual(['driving-car', 'cycling-regular', 'foot-walking']);
    expect(DEFAULT_OSM_TILES.attribution).toContain('OpenStreetMap');
    expect(DEFAULT_OSM_TILES.urlTemplate).toContain('{z}/{x}/{y}');
  });

  it('normalizes coordinates to 6 decimals, collapses -0, and keys by provider, profile, from and to', () => {
    expect(formatPointKey({ lat: -0, lng: 0.0000001 })).toBe('0.000000,0.000000');
    expect(formatPointKey(NORTHGATE)).toBe('45.123456,9.654321');
    expect(() => formatPointKey({ lat: 91, lng: 0 })).toThrow(RangeError);
    expect(() => formatPointKey({ lat: 0, lng: -181 })).toThrow(RangeError);
    expect(() => formatPointKey({ lat: Number.NaN, lng: 0 })).toThrow(RangeError);

    const cols = toLegCacheColumns(' OpenRouteService ', 'driving-car', NORTHGATE, RIVERFORD);
    expect(cols).toEqual({
      provider: 'openrouteservice',
      profile: 'driving-car',
      fromKey: '45.123456,9.654321',
      toKey: '45.223456,9.754321',
    });

    const sameWithinSubMicron = legCacheKey(
      'openrouteservice',
      'driving-car',
      { lat: 45.1234561, lng: 9.6543211 },
      RIVERFORD,
    );
    expect(sameWithinSubMicron).toBe(
      legCacheKey('openrouteservice', 'driving-car', NORTHGATE, RIVERFORD),
    );
    expect(legCacheKey('osrm', 'driving-car', NORTHGATE, RIVERFORD)).not.toBe(sameWithinSubMicron);
    expect(legCacheKey('openrouteservice', 'foot-walking', NORTHGATE, RIVERFORD)).not.toBe(
      sameWithinSubMicron,
    );
    expect(legCacheKey('openrouteservice', 'driving-car', RIVERFORD, NORTHGATE)).not.toBe(
      sameWithinSubMicron,
    );
    expect(() => toLegCacheColumns('   ', 'driving-car', NORTHGATE, RIVERFORD)).toThrow(RangeError);
  });

  it('validates route, matrix and geocode requests', () => {
    expect(validateRouteRequest({ from: NORTHGATE, to: RIVERFORD })).toEqual({
      ok: true,
      value: { from: NORTHGATE, to: RIVERFORD, profile: 'driving-car' },
    });
    expect(validateRouteRequest({ from: NORTHGATE, to: RIVERFORD, profile: 'flying' }).ok).toBe(
      false,
    );
    expect(validateRouteRequest({ from: { lat: 100, lng: 0 }, to: RIVERFORD }).ok).toBe(false);
    expect(validateRouteRequest({ from: NORTHGATE, to: RIVERFORD, extra: 1 }).ok).toBe(false);

    expect(
      validateMatrixRequest({ points: [NORTHGATE, RIVERFORD], profile: 'foot-walking' }),
    ).toEqual({
      ok: true,
      value: { points: [NORTHGATE, RIVERFORD], profile: 'foot-walking' },
    });
    expect(validateMatrixRequest({ points: [NORTHGATE] }).ok).toBe(false);

    expect(validateGeocodeRequest({ query: '  Northgate  ' })).toEqual({
      ok: true,
      value: { query: 'Northgate', limit: 5 },
    });
    expect(validateGeocodeRequest({ query: 'Northgate', limit: 10 })).toEqual({
      ok: true,
      value: { query: 'Northgate', limit: 10 },
    });
    expect(validateGeocodeRequest({ query: '   ' }).ok).toBe(false);
    expect(validateGeocodeRequest({ query: 'Northgate', limit: 0 }).ok).toBe(false);
  });
});

describe('cachedMapProvider and memory leg cache (F-007-T01)', () => {
  it('fetches an uncached route once and serves subsequent lookups from the leg cache', async () => {
    const cache = createMemoryLegCache(() => '2026-11-26T07:00:00.000Z');
    const { provider, spies } = makeStubProvider();
    const cached = cachedMapProvider(provider, cache);

    const first: RouteResult = await cached.route({ from: NORTHGATE, to: RIVERFORD });
    expect(first.cached).toBe(false);
    expect(first.distanceMetres).toBe(14_250);
    expect(first.travelMinutes).toBe(19);
    expect(first.geometry).toHaveLength(3);
    expect(spies.route).toHaveBeenCalledTimes(1);

    const second = await cached.route({
      from: { lat: 45.1234562, lng: 9.6543212 },
      to: RIVERFORD,
    });
    expect(second.cached).toBe(true);
    expect(second.distanceMetres).toBe(14_250);
    expect(second.travelMinutes).toBe(19);
    expect(second.geometry).toHaveLength(3);
    expect(spies.route).toHaveBeenCalledTimes(1);

    // Different profile misses cache and queries provider
    await cached.route({ from: NORTHGATE, to: RIVERFORD, profile: 'cycling-regular' });
    expect(spies.route).toHaveBeenCalledTimes(2);
  });

  it('short-circuits zero-length same-point routes without calling the provider', async () => {
    const cache = createMemoryLegCache();
    const { provider, spies } = makeStubProvider();
    const cached = cachedMapProvider(provider, cache);

    const same = await cached.route({ from: NORTHGATE, to: NORTHGATE });
    expect(same).toEqual({
      provider: 'openrouteservice',
      profile: 'driving-car',
      from: NORTHGATE,
      to: NORTHGATE,
      distanceMetres: 0,
      travelMinutes: 0,
      geometry: [],
      cached: true,
    });
    expect(spies.route).not.toHaveBeenCalled();
  });

  it('populates the leg cache from matrix results, skips re-querying on what-if reorder, and preserves route geometry', async () => {
    const cache = createMemoryLegCache();
    const { provider, spies } = makeStubProvider();
    const cached = cachedMapProvider(provider, cache);

    // Cache one detailed route polyline first
    await cached.route({ from: NORTHGATE, to: RIVERFORD });
    expect(spies.route).toHaveBeenCalledTimes(1);

    // Matrix over 3 points misses remaining pairs -> calls provider.matrix once
    const firstMatrix = await cached.matrix({ points: [NORTHGATE, RIVERFORD, OAKRIDGE] });
    expect(spies.matrix).toHaveBeenCalledTimes(1);
    expect(firstMatrix.cells).toHaveLength(9);

    // Reordering the same stops in a what-if hits the cache for every pair -> zero provider calls!
    const reordered = await cached.matrix({ points: [OAKRIDGE, NORTHGATE, RIVERFORD] });
    expect(spies.matrix).toHaveBeenCalledTimes(1);
    const oakToNorth = reordered.cells.find((c) => c.fromIndex === 0 && c.toIndex === 1);
    expect(oakToNorth).toEqual({
      fromIndex: 0,
      toIndex: 1,
      distanceMetres: 16_000,
      travelMinutes: 20,
    });

    // And the earlier route geometry for NORTHGATE -> RIVERFORD was not overwritten by matrix
    const routeAgain = await cached.route({ from: NORTHGATE, to: RIVERFORD });
    expect(routeAgain.cached).toBe(true);
    expect(routeAgain.geometry).toHaveLength(3);
    expect(spies.route).toHaveBeenCalledTimes(1);
  });

  it('forwards geocode and autocomplete calls through the adapter', async () => {
    const cache = createMemoryLegCache();
    const { provider, spies } = makeStubProvider();
    const cached = cachedMapProvider(provider, cache);

    const geo = await cached.geocode({ query: 'Northgate' });
    const auto = await cached.autocomplete({ query: 'North' });
    expect(geo[0]?.label).toBe('Northgate Square');
    expect(auto[0]?.label).toBe('Northgate Station');
    expect(spies.geocode).toHaveBeenCalledTimes(1);
    expect(spies.autocomplete).toHaveBeenCalledTimes(1);
  });
});
