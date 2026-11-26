import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import type {
  GeocodeCandidate,
  MapPoint,
  MatrixResult,
  RouteResult,
} from '../src/app/maps/map-provider.ts';
import { startServer, type RunningServer } from './app.ts';
import { createOpenRouteServiceProvider, MapProviderError } from './ors-provider.ts';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'ors');
const readFixture = (name: string) => readFileSync(join(FIXTURES_DIR, name), 'utf8');

// Invented places and coordinates only (AGENTS.md Privacy).
const PORTWIND: MapPoint = { lat: 45.1, lng: 9.1 };
const MILLHAVEN: MapPoint = { lat: 45.22, lng: 9.25 };
const GREYFELL: MapPoint = { lat: 45.3, lng: 9.4 };

interface RecordedCall {
  url: string;
  method: string;
  authHeader: string | null;
  body: unknown;
}

function makeFixtureFetch(
  override?: (call: RecordedCall) => Response | Promise<Response> | undefined,
) {
  const calls: RecordedCall[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? 'GET';
    const headers = new Headers(init?.headers);
    const authHeader = headers.get('authorization');
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
    const call: RecordedCall = { url, method, authHeader, body };
    calls.push(call);

    const custom = await override?.(call);
    if (custom) return custom;

    const parsed = new URL(url);
    if (parsed.pathname === '/v2/directions/driving-car/geojson' && method === 'POST') {
      return new Response(readFixture('directions-driving-car.json'), {
        status: 200,
        headers: { 'content-type': 'application/geo+json' },
      });
    }
    if (parsed.pathname === '/v2/matrix/driving-car' && method === 'POST') {
      return new Response(readFixture('matrix-driving-car.json'), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (parsed.pathname === '/geocode/search' && method === 'GET') {
      return new Response(readFixture('geocode-search.json'), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (parsed.pathname === '/geocode/autocomplete' && method === 'GET') {
      return new Response(readFixture('geocode-autocomplete.json'), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ error: { message: 'not found' } }), { status: 404 });
  };

  return { fetchImpl, calls };
}

describe('OpenRouteService provider against recorded fixtures (F-007-T03)', () => {
  it('parses directions, matrix, geocode and autocomplete and sends the key only in Authorization', async () => {
    const { fetchImpl, calls } = makeFixtureFetch();
    const ors = createOpenRouteServiceProvider({
      apiKey: 'fixture-ors-secret',
      baseUrl: 'https://ors.fixture.test',
      fetchImpl,
    });

    const route = await ors.route({ from: PORTWIND, to: MILLHAVEN });
    assert.equal(route.provider, 'openrouteservice');
    assert.equal(route.profile, 'driving-car');
    assert.equal(route.distanceMetres, 21_451);
    assert.equal(route.travelMinutes, 27);
    assert.deepEqual(route.geometry, [
      { lat: 45.1, lng: 9.1 },
      { lat: 45.16, lng: 9.18 },
      { lat: 45.22, lng: 9.25 },
    ]);
    assert.deepEqual(calls[0]?.body, {
      coordinates: [
        [9.1, 45.1],
        [9.25, 45.22],
      ],
    });
    assert.equal(calls[0]?.authHeader, 'fixture-ors-secret');
    assert.equal(calls[0]?.url.includes('fixture-ors-secret'), false);

    const matrix = await ors.matrix({ points: [PORTWIND, MILLHAVEN, GREYFELL] });
    assert.equal(matrix.cells.length, 9);
    const pToM = matrix.cells.find((c) => c.fromIndex === 0 && c.toIndex === 1);
    assert.deepEqual(pToM, {
      fromIndex: 0,
      toIndex: 1,
      distanceMetres: 21_451,
      travelMinutes: 27,
    });
    assert.deepEqual(calls[1]?.body, {
      locations: [
        [9.1, 45.1],
        [9.25, 45.22],
        [9.4, 45.3],
      ],
      metrics: ['distance', 'duration'],
      units: 'm',
    });

    const found = await ors.geocode({ query: 'Portwind', limit: 5 });
    assert.equal(found.length, 2);
    assert.deepEqual(found[0], {
      label: 'Harbour Quay, Portwind, Inventedland',
      location: PORTWIND,
      country: 'Inventedland',
      region: 'Coast Shire',
      locality: 'Portwind',
    });
    assert.equal(calls[2]?.authHeader, 'fixture-ors-secret');
    assert.equal(calls[2]?.url.includes('fixture-ors-secret'), false);

    const suggested = await ors.autocomplete({ query: 'Harb', limit: 3 });
    assert.equal(suggested.length, 1);
    assert.equal(suggested[0]?.label, 'Harbour Quay, Portwind');
    assert.equal(suggested[0]?.region, null);
  });

  it('reports missing key, invalid key, quota limits and unreachable routes without leaking secrets', async () => {
    const missingKey = createOpenRouteServiceProvider({
      apiKey: null,
      fetchImpl: makeFixtureFetch().fetchImpl,
    });
    await assert.rejects(
      () => missingKey.route({ from: PORTWIND, to: MILLHAVEN }),
      (err: unknown) =>
        err instanceof MapProviderError &&
        err.status === 503 &&
        err.code === 'missing_key' &&
        /config\.local\.json/i.test(err.userMessage),
    );

    const quotaOrs = createOpenRouteServiceProvider({
      apiKey: 'secret-token-never-echo',
      fetchImpl: makeFixtureFetch(
        () =>
          new Response(readFixture('error-quota-429.json'), {
            status: 429,
            headers: { 'content-type': 'application/json' },
          }),
      ).fetchImpl,
    });
    await assert.rejects(
      () => quotaOrs.route({ from: PORTWIND, to: MILLHAVEN }),
      (err: unknown) =>
        err instanceof MapProviderError &&
        err.status === 429 &&
        err.code === 'quota_exceeded' &&
        /quota|rate limit/i.test(err.userMessage) &&
        !err.userMessage.includes('secret-token-never-echo'),
    );

    const badKeyOrs = createOpenRouteServiceProvider({
      apiKey: 'secret-token-never-echo',
      fetchImpl: makeFixtureFetch(
        () =>
          new Response(JSON.stringify({ error: 'Access disallowed for secret-token-never-echo' }), {
            status: 403,
            headers: { 'content-type': 'application/json' },
          }),
      ).fetchImpl,
    });
    await assert.rejects(
      () => badKeyOrs.geocode({ query: 'Portwind' }),
      (err: unknown) =>
        err instanceof MapProviderError &&
        err.status === 502 &&
        err.code === 'invalid_key' &&
        !err.userMessage.includes('secret-token-never-echo'),
    );

    const nullCellOrs = createOpenRouteServiceProvider({
      apiKey: 'fixture-key',
      fetchImpl: makeFixtureFetch(
        () =>
          new Response(
            JSON.stringify({
              distances: [
                [0, null],
                [null, 0],
              ],
              durations: [
                [0, null],
                [null, 0],
              ],
            }),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            },
          ),
      ).fetchImpl,
    });
    await assert.rejects(
      () => nullCellOrs.matrix({ points: [PORTWIND, MILLHAVEN] }),
      (err: unknown) =>
        err instanceof MapProviderError && err.status === 422 && err.code === 'unreachable_route',
    );
  });
});

describe('local /api/maps endpoints and SQLite leg cache join (F-007-T03)', () => {
  let dataDir: string;
  let server: RunningServer | undefined;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), 'hobo-ors-api-'));
  });

  afterEach(async () => {
    await server?.close();
    server = undefined;
    rmSync(dataDir, { recursive: true, force: true });
  });

  it('exposes route, matrix, geocode and autocomplete over /api/maps and serves cached legs even after ORS hits 429', async () => {
    let forceQuota429 = false;
    const { fetchImpl, calls } = makeFixtureFetch(() =>
      forceQuota429
        ? new Response(readFixture('error-quota-429.json'), {
            status: 429,
            headers: { 'content-type': 'application/json' },
          })
        : undefined,
    );

    server = await startServer({
      host: '127.0.0.1',
      port: 0,
      dataDir,
      mapProvider: 'openrouteservice',
      openRouteServiceApiKey: 'local-only-ors-key',
      openRouteServiceBaseUrl: 'https://ors.fixture.test',
      fetchImpl,
    });

    // 1. Route caches leg in SQLite on first call
    const routeRes1 = await fetch(`${server.url}/api/maps/route`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ from: PORTWIND, to: MILLHAVEN }),
    });
    assert.equal(routeRes1.status, 200);
    const route1 = (await routeRes1.json()) as RouteResult;
    assert.equal(route1.cached, false);
    assert.equal(route1.distanceMetres, 21_451);
    assert.equal(route1.travelMinutes, 27);
    assert.equal(calls.length, 1);

    // 2. Geocode & autocomplete
    const geoRes = await fetch(`${server.url}/api/maps/geocode?q=Portwind&limit=5`);
    assert.equal(geoRes.status, 200);
    const geo = (await geoRes.json()) as GeocodeCandidate[];
    assert.equal(geo.length, 2);
    assert.equal(geo[0]?.label, 'Harbour Quay, Portwind, Inventedland');

    const autoRes = await fetch(`${server.url}/api/maps/autocomplete?q=Harb`);
    assert.equal(autoRes.status, 200);
    const auto = (await autoRes.json()) as GeocodeCandidate[];
    assert.equal(auto.length, 1);

    // 3. Matrix caches all pairs
    const matrixRes = await fetch(`${server.url}/api/maps/matrix`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ points: [PORTWIND, MILLHAVEN, GREYFELL] }),
    });
    assert.equal(matrixRes.status, 200);
    const matrix = (await matrixRes.json()) as MatrixResult;
    assert.equal(matrix.cells.length, 9);
    assert.equal(calls.length, 4);

    // 4. Now simulate ORS daily quota exhaustion (429): cached legs STILL succeed without hitting ORS,
    //    while uncached legs report 429 quota_exceeded cleanly without leaking the key!
    forceQuota429 = true;

    const cachedRouteRes = await fetch(`${server.url}/api/maps/route`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ from: PORTWIND, to: MILLHAVEN }),
    });
    assert.equal(cachedRouteRes.status, 200);
    const cachedRoute = (await cachedRouteRes.json()) as RouteResult;
    assert.equal(cachedRoute.cached, true);
    assert.equal(cachedRoute.geometry.length, 3);
    assert.equal(calls.length, 4);

    const uncachedRes = await fetch(`${server.url}/api/maps/route`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ from: PORTWIND, to: { lat: 46.0, lng: 10.0 } }),
    });
    assert.equal(uncachedRes.status, 429);
    const errBody = (await uncachedRes.json()) as { code: string; errors: string[] };
    assert.equal(errBody.code, 'quota_exceeded');
    assert.ok(errBody.errors[0] && /quota|rate limit/i.test(errBody.errors[0]));
    assert.equal(JSON.stringify(errBody).includes('local-only-ors-key'), false);

    // 5. Validation errors return 400
    const badGeo = await fetch(`${server.url}/api/maps/geocode?q=`);
    assert.equal(badGeo.status, 400);
  });
});
