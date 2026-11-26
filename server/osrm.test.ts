import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import type { MapPoint, MapProvider, RouteResult } from '../src/app/maps/map-provider.ts';
import { startServer, type RunningServer } from './app.ts';
import { MapProviderError } from './map-adapter.ts';
import { createOpenRouteServiceProvider } from './ors-provider.ts';
import { createOsrmProvider } from './osrm-provider.ts';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const fixture = (name: string) => readFileSync(join(FIXTURES, name), 'utf8');
const json = (body: string, status = 200) =>
  new Response(body, { status, headers: { 'content-type': 'application/json' } });

// Invented places and coordinates only (AGENTS.md Privacy).
const PORTWIND: MapPoint = { lat: 45.1, lng: 9.1 };
const MILLHAVEN: MapPoint = { lat: 45.22, lng: 9.25 };
const GREYFELL: MapPoint = { lat: 45.3, lng: 9.4 };

interface Call {
  url: string;
  init: RequestInit | undefined;
}

/** A fetch that answers from recorded fixtures, or from `override` when it returns a Response. */
function fixtureFetch(override?: (call: Call) => Response | undefined) {
  const calls: Call[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const call = { url, init };
    calls.push(call);
    const custom = override?.(call);
    if (custom) return custom;
    const path = new URL(url).pathname;
    if (path.startsWith('/route/v1/car/')) return json(fixture('osrm/route-car.json'));
    if (path.startsWith('/table/v1/car/')) return json(fixture('osrm/table-car.json'));
    if (path === '/v2/directions/driving-car/geojson') {
      return json(fixture('ors/directions-driving-car.json'));
    }
    if (path === '/v2/matrix/driving-car') return json(fixture('ors/matrix-driving-car.json'));
    return json(JSON.stringify({ code: 'InvalidUrl', message: 'not found' }), 400);
  };
  return { fetchImpl, calls };
}

const quiet = () => undefined;

/** The same recorded-fixture contract for every routing provider behind the adapter. */
const PROVIDERS: Record<
  string,
  {
    make: (fetchImpl: typeof fetch, timeoutMs?: number) => MapProvider;
    noRoute: () => Response;
    refusal: () => Response;
  }
> = {
  openrouteservice: {
    make: (fetchImpl, timeoutMs) =>
      createOpenRouteServiceProvider({
        apiKey: 'fixture-key',
        baseUrl: 'https://ors.fixture.test',
        fetchImpl,
        timeoutMs,
        log: quiet,
      }),
    noRoute: () =>
      json(JSON.stringify({ error: { code: 2009, message: 'raw upstream detail' } }), 404),
    refusal: () =>
      json(JSON.stringify({ error: { code: 2003, message: 'raw upstream detail' } }), 400),
  },
  osrm: {
    make: (fetchImpl, timeoutMs) =>
      createOsrmProvider({
        baseUrl: 'http://osrm.fixture.test:5000',
        fetchImpl,
        timeoutMs,
        log: quiet,
      }),
    noRoute: () => json(fixture('osrm/error-no-route.json'), 400),
    refusal: () =>
      json(JSON.stringify({ code: 'InvalidValue', message: 'raw upstream detail' }), 400),
  },
};

for (const [name, provider] of Object.entries(PROVIDERS)) {
  describe(`routing provider contract against recorded fixtures: ${name} (F-013-T01)`, () => {
    it('gives the same route and matrix in whole metres and minutes', async () => {
      const ors = provider.make(fixtureFetch().fetchImpl);
      const route = await ors.route({ from: PORTWIND, to: MILLHAVEN });
      assert.equal(route.provider, name);
      assert.equal(route.profile, 'driving-car');
      assert.equal(route.distanceMetres, 21_451);
      assert.equal(route.travelMinutes, 27);
      assert.deepEqual(route.geometry, [
        { lat: 45.1, lng: 9.1 },
        { lat: 45.16, lng: 9.18 },
        { lat: 45.22, lng: 9.25 },
      ]);
      const matrix = await ors.matrix({ points: [PORTWIND, MILLHAVEN, GREYFELL] });
      assert.equal(matrix.cells.length, 9);
      assert.deepEqual(
        matrix.cells.find((c) => c.fromIndex === 0 && c.toIndex === 1),
        { fromIndex: 0, toIndex: 1, distanceMetres: 21_451, travelMinutes: 27 },
      );
      assert.deepEqual(
        matrix.cells.find((c) => c.fromIndex === 2 && c.toIndex === 0),
        { fromIndex: 2, toIndex: 0, distanceMetres: 39_101, travelMinutes: 49 },
      );
    });

    it('maps no-route to unreachable_route and other refusals to upstream_error, without upstream text', async () => {
      const noRoute = provider.make(fixtureFetch(provider.noRoute).fetchImpl);
      await assert.rejects(
        () => noRoute.route({ from: PORTWIND, to: MILLHAVEN }),
        (err: unknown) =>
          err instanceof MapProviderError &&
          err.status === 422 &&
          err.code === 'unreachable_route' &&
          !err.userMessage.includes('raw upstream detail') &&
          !err.userMessage.includes('Impossible route'),
      );
      const refused = provider.make(fixtureFetch(provider.refusal).fetchImpl);
      await assert.rejects(
        () => refused.matrix({ points: [PORTWIND, MILLHAVEN] }),
        (err: unknown) =>
          err instanceof MapProviderError &&
          err.status === 502 &&
          err.code === 'upstream_error' &&
          !err.userMessage.includes('raw upstream detail'),
      );
    });

    it('reports a null matrix cell as unreachable_route and 429 as quota_exceeded', async () => {
      const nullCell = provider.make(
        fixtureFetch(() =>
          json(
            JSON.stringify({
              code: 'Ok',
              distances: [
                [0, null],
                [null, 0],
              ],
              durations: [
                [0, null],
                [null, 0],
              ],
            }),
          ),
        ).fetchImpl,
      );
      await assert.rejects(
        () => nullCell.matrix({ points: [PORTWIND, MILLHAVEN] }),
        (err: unknown) => err instanceof MapProviderError && err.code === 'unreachable_route',
      );
      const limited = provider.make(fixtureFetch(() => json('{}', 429)).fetchImpl);
      await assert.rejects(
        () => limited.route({ from: PORTWIND, to: MILLHAVEN }),
        (err: unknown) =>
          err instanceof MapProviderError && err.status === 429 && err.code === 'quota_exceeded',
      );
    });

    it('gives up on a call that outlasts the timeout as upstream_error', async () => {
      const hanging: typeof fetch = (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        });
      await assert.rejects(
        () => provider.make(hanging, 20).route({ from: PORTWIND, to: MILLHAVEN }),
        (err: unknown) =>
          err instanceof MapProviderError &&
          err.code === 'upstream_error' &&
          /did not answer/.test(err.userMessage),
      );
    });
  });
}

describe('OSRM provider (F-013-T01)', () => {
  it('calls only the configured base URL with OSRM profile names, lng,lat pairs and no redirects', async () => {
    const { fetchImpl, calls } = fixtureFetch((call) =>
      new URL(call.url).pathname.includes('/bike/') || new URL(call.url).pathname.includes('/foot/')
        ? json(fixture('osrm/route-car.json'))
        : undefined,
    );
    const osrm = createOsrmProvider({ baseUrl: 'http://osrm.fixture.test:5000/', fetchImpl });
    await osrm.route({ from: PORTWIND, to: MILLHAVEN });
    await osrm.route({ from: PORTWIND, to: MILLHAVEN, profile: 'cycling-regular' });
    await osrm.route({ from: PORTWIND, to: MILLHAVEN, profile: 'foot-walking' });
    await osrm.matrix({ points: [PORTWIND, MILLHAVEN, GREYFELL] });
    const urls = calls.map((c) => new URL(c.url));
    assert.deepEqual(
      urls.map((u) => u.origin),
      Array(4).fill('http://osrm.fixture.test:5000'),
    );
    assert.equal(urls[0]?.pathname, '/route/v1/car/9.100000,45.100000;9.250000,45.220000');
    assert.equal(urls[0]?.searchParams.get('geometries'), 'geojson');
    assert.equal(urls[0]?.searchParams.get('overview'), 'full');
    assert.match(urls[1]?.pathname ?? '', /^\/route\/v1\/bike\//);
    assert.match(urls[2]?.pathname ?? '', /^\/route\/v1\/foot\//);
    assert.equal(
      urls[3]?.pathname,
      '/table/v1/car/9.100000,45.100000;9.250000,45.220000;9.400000,45.300000',
    );
    assert.equal(urls[3]?.searchParams.get('annotations'), 'distance,duration');
    assert.ok(calls.every((c) => c.init?.redirect === 'error' && c.init.method === 'GET'));
  });

  it('maps NoSegment to unreachable_route and logs other OSRM text on the server only', async () => {
    const noSegment = createOsrmProvider({
      baseUrl: 'http://osrm.fixture.test',
      fetchImpl: fixtureFetch(() =>
        json(
          JSON.stringify({ code: 'NoSegment', message: 'Could not find a matching segment' }),
          400,
        ),
      ).fetchImpl,
    });
    await assert.rejects(
      () => noSegment.route({ from: PORTWIND, to: MILLHAVEN }),
      (err: unknown) => err instanceof MapProviderError && err.code === 'unreachable_route',
    );

    const logged: string[] = [];
    const tooBig = createOsrmProvider({
      baseUrl: 'http://osrm.fixture.test',
      fetchImpl: fixtureFetch(() =>
        json(JSON.stringify({ code: 'TooBig', message: 'Too many table coordinates' }), 400),
      ).fetchImpl,
      log: (message) => logged.push(message),
    });
    await assert.rejects(
      () => tooBig.matrix({ points: [PORTWIND, MILLHAVEN] }),
      (err: unknown) =>
        err instanceof MapProviderError &&
        err.code === 'upstream_error' &&
        err.userMessage === 'OSRM refused the request (status 400).',
    );
    assert.deepEqual(logged, ['OSRM 400 code TooBig: Too many table coordinates']);
  });

  it('reports a missing base URL, an unreachable service, malformed answers and place search', async () => {
    const unset = createOsrmProvider({ baseUrl: null, fetchImpl: fixtureFetch().fetchImpl });
    await assert.rejects(
      () => unset.route({ from: PORTWIND, to: MILLHAVEN }),
      (err: unknown) =>
        err instanceof MapProviderError &&
        err.status === 503 &&
        err.code === 'missing_key' &&
        /osrmBaseUrl/.test(err.userMessage),
    );

    const down = createOsrmProvider({
      baseUrl: 'http://osrm.fixture.test',
      fetchImpl: async () => {
        throw new TypeError('fetch failed: connect ECONNREFUSED 192.0.2.10:5000');
      },
    });
    await assert.rejects(
      () => down.route({ from: PORTWIND, to: MILLHAVEN }),
      (err: unknown) =>
        err instanceof MapProviderError &&
        err.code === 'upstream_error' &&
        !err.userMessage.includes('ECONNREFUSED'),
    );

    const garbled = createOsrmProvider({
      baseUrl: 'http://osrm.fixture.test',
      fetchImpl: fixtureFetch(() => new Response('<html>proxy error</html>', { status: 200 }))
        .fetchImpl,
      log: quiet,
    });
    await assert.rejects(
      () => garbled.route({ from: PORTWIND, to: MILLHAVEN }),
      (err: unknown) =>
        err instanceof MapProviderError &&
        err.code === 'upstream_error' &&
        !err.userMessage.includes('proxy error'),
    );

    const osrm = createOsrmProvider({
      baseUrl: 'http://osrm.fixture.test',
      fetchImpl: fixtureFetch().fetchImpl,
    });
    for (const search of [osrm.geocode, osrm.autocomplete]) {
      await assert.rejects(
        () => search({ query: 'Portwind' }),
        (err: unknown) =>
          err instanceof MapProviderError && err.status === 501 && err.code === 'upstream_error',
      );
    }
  });
});

describe('local /api/maps with mapProvider osrm (F-013-T01)', () => {
  let dataDir: string;
  let server: RunningServer | undefined;

  beforeEach(() => (dataDir = mkdtempSync(join(tmpdir(), 'hobo-osrm-api-'))));
  afterEach(async () => {
    await server?.close();
    server = undefined;
    rmSync(dataDir, { recursive: true, force: true });
  });

  it('routes through OSRM, caches the leg under the osrm provider and maps errors', async () => {
    let noRoute = false;
    const { fetchImpl, calls } = fixtureFetch(() =>
      noRoute ? json(fixture('osrm/error-no-route.json'), 400) : undefined,
    );
    server = await startServer({
      host: '127.0.0.1',
      port: 0,
      dataDir,
      mapProvider: 'osrm',
      osrmBaseUrl: 'http://osrm.fixture.test:5000',
      fetchImpl,
    });
    const post = (body: unknown) =>
      fetch(`${server!.url}/api/maps/route`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

    const first = (await (await post({ from: PORTWIND, to: MILLHAVEN })).json()) as RouteResult;
    assert.equal(first.provider, 'osrm');
    assert.equal(first.cached, false);
    assert.equal(first.distanceMetres, 21_451);
    const again = (await (await post({ from: PORTWIND, to: MILLHAVEN })).json()) as RouteResult;
    assert.equal(again.cached, true);
    assert.equal(calls.length, 1);

    noRoute = true;
    const refused = await post({ from: PORTWIND, to: GREYFELL });
    assert.equal(refused.status, 422);
    const body = (await refused.json()) as { code: string; errors: string[] };
    assert.equal(body.code, 'unreachable_route');
    assert.equal(JSON.stringify(body).includes('Impossible route'), false);

    const search = await fetch(`${server.url}/api/maps/geocode?q=Portwind`);
    assert.equal(search.status, 501);
    assert.equal(((await search.json()) as { code: string }).code, 'upstream_error');
  });
});
