import {
  DEFAULT_OSM_TILES,
  DEFAULT_TRAVEL_PROFILE,
  formatPointKey,
  type MapPoint,
  type MapProvider,
  type MatrixCell,
  type MatrixRequest,
  type MatrixResult,
  type RouteRequest,
  type RouteResult,
  type TravelProfile,
} from '../src/app/maps/map-provider.ts';
import { MapProviderError } from './map-adapter.ts';

/** How long one OSRM call may take before it counts as an upstream error. */
export const DEFAULT_OSRM_TIMEOUT_MS = 10_000;

export interface OsrmProviderOptions {
  /** From local config only (`osrmBaseUrl`), never from a request; null when not configured. */
  readonly baseUrl: string | null;
  readonly fetchImpl?: typeof fetch;
  /** Milliseconds per call; defaults to `DEFAULT_OSRM_TIMEOUT_MS`. */
  readonly timeoutMs?: number;
  /** Server-side log for upstream details the user does not see; defaults to `console.error`. */
  readonly log?: (message: string) => void;
}

/** Hobo travel profiles to the profile names OSRM's own Lua profiles use (car, bike, foot). */
const OSRM_PROFILES: Readonly<Record<TravelProfile, string>> = {
  'driving-car': 'car',
  'cycling-regular': 'bike',
  'foot-walking': 'foot',
};

/** OSRM's "no route" (NoRoute) and "point not near a road" (NoSegment): ORS 2009 and 2010. */
const OSRM_NO_ROUTE_CODES: ReadonlySet<string> = new Set(['NoRoute', 'NoSegment']);

function invalid(what: string): MapProviderError {
  return new MapProviderError(502, 'upstream_error', `OSRM returned an invalid ${what}.`);
}

function wholeMetres(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw invalid('distance');
  return Math.round(value);
}

function wholeMinutes(seconds: unknown): number {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) {
    throw invalid('duration');
  }
  return Math.round(seconds / 60);
}

function parseLngLatPair(raw: unknown): MapPoint | null {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const [lng, lat] = raw as unknown[];
  if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90) return null;
  if (typeof lng !== 'number' || !Number.isFinite(lng) || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/** `lng,lat;lng,lat` from validated points only: no request text reaches the URL. */
function coordinatePath(points: readonly MapPoint[]): string {
  return points
    .map((point) => {
      const [lat, lng] = formatPointKey(point).split(',');
      return `${lng},${lat}`;
    })
    .join(';');
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Self-hosted OSRM routing and matrix adapter running only inside `server/` (F-013-T01). */
export function createOsrmProvider(options: OsrmProviderOptions): MapProvider {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_OSRM_TIMEOUT_MS;
  const log = options.log ?? ((message: string) => console.error(message));

  function requireBaseUrl(): string {
    const base = options.baseUrl?.trim().replace(/\/+$/, '') ?? '';
    if (!base) {
      throw new MapProviderError(
        503,
        'missing_key',
        'The OSRM address is not configured. Add osrmBaseUrl to server/config.local.json.',
      );
    }
    return base;
  }

  async function call(service: 'route' | 'table', profile: TravelProfile, path: string) {
    const base = requireBaseUrl();
    const url = `${base}/${service}/v1/${OSRM_PROFILES[profile]}/${path}`;
    let response: Response;
    try {
      // A redirect could send the call to a host the config never named: refuse it.
      response = await fetchImpl(url, {
        method: 'GET',
        headers: { accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (isTimeout(error)) throw timeoutError();
      throw new MapProviderError(
        502,
        'upstream_error',
        'Could not reach OSRM. Check osrmBaseUrl and that the routing service is running.',
      );
    }

    let payload: Record<string, unknown> | undefined;
    try {
      payload = asRecord(await response.json());
    } catch (error) {
      if (isTimeout(error)) throw timeoutError();
    }

    const code = typeof payload?.['code'] === 'string' ? payload['code'] : undefined;
    if (response.ok && code === 'Ok') return payload!;
    if (response.status === 429) {
      throw new MapProviderError(
        429,
        'quota_exceeded',
        'OSRM rate limit reached. Routes and matrices whose legs are all cached still work; anything with a new leg waits until the limit resets.',
      );
    }
    if (code !== undefined && OSRM_NO_ROUTE_CODES.has(code)) {
      throw new MapProviderError(
        422,
        'unreachable_route',
        'OSRM could not find a route for the given locations.',
      );
    }
    if (response.ok && payload === undefined) throw invalid('answer');
    // Other refusals (bad parameters, limits, server faults): the OSRM text stays in the server log.
    const message = typeof payload?.['message'] === 'string' ? payload['message'] : 'no message';
    log(`OSRM ${response.status}${code === undefined ? '' : ` code ${code}`}: ${message}`);
    throw new MapProviderError(
      502,
      'upstream_error',
      `OSRM refused the request (status ${response.status}).`,
    );
  }

  function timeoutError(): MapProviderError {
    return new MapProviderError(
      502,
      'upstream_error',
      `OSRM did not answer within ${Math.ceil(timeoutMs / 1000)} s. Try again.`,
    );
  }

  function noPlaceSearch(): never {
    throw new MapProviderError(
      501,
      'upstream_error',
      'Place search is not available with OSRM, which only routes. Use openrouteservice as mapProvider to search places.',
    );
  }

  return {
    id: 'osrm',
    tiles: DEFAULT_OSM_TILES,

    async route(request: RouteRequest): Promise<RouteResult> {
      const profile = request.profile ?? DEFAULT_TRAVEL_PROFILE;
      const payload = await call(
        'route',
        profile,
        `${coordinatePath([request.from, request.to])}?overview=full&geometries=geojson&alternatives=false&steps=false`,
      );
      const routes = payload['routes'];
      const first = Array.isArray(routes) ? asRecord(routes[0]) : undefined;
      if (!first) {
        throw new MapProviderError(
          422,
          'unreachable_route',
          'No route found between the selected locations.',
        );
      }
      const rawCoords = asRecord(first['geometry'])?.['coordinates'];
      const geometry: MapPoint[] = [];
      for (const pair of Array.isArray(rawCoords) ? rawCoords : []) {
        const point = parseLngLatPair(pair);
        if (point) geometry.push(point);
      }
      return {
        provider: 'osrm',
        profile,
        from: request.from,
        to: request.to,
        distanceMetres: wholeMetres(first['distance']),
        travelMinutes: wholeMinutes(first['duration']),
        geometry,
      };
    },

    async matrix(request: MatrixRequest): Promise<MatrixResult> {
      const profile = request.profile ?? DEFAULT_TRAVEL_PROFILE;
      const payload = await call(
        'table',
        profile,
        `${coordinatePath(request.points)}?annotations=distance,duration`,
      );
      const distances = payload['distances'];
      const durations = payload['durations'];
      const count = request.points.length;
      if (
        !Array.isArray(distances) ||
        !Array.isArray(durations) ||
        distances.length !== count ||
        durations.length !== count
      ) {
        throw invalid('matrix size');
      }
      const cells: MatrixCell[] = [];
      for (let i = 0; i < count; i++) {
        const distRow: unknown = distances[i];
        const durRow: unknown = durations[i];
        if (
          !Array.isArray(distRow) ||
          !Array.isArray(durRow) ||
          distRow.length !== count ||
          durRow.length !== count
        ) {
          throw invalid('matrix row');
        }
        for (let j = 0; j < count; j++) {
          if (distRow[j] === null || durRow[j] === null) {
            throw new MapProviderError(
              422,
              'unreachable_route',
              'One or more locations could not be connected by route.',
            );
          }
          cells.push({
            fromIndex: i,
            toIndex: j,
            distanceMetres: wholeMetres(distRow[j]),
            travelMinutes: wholeMinutes(durRow[j]),
          });
        }
      }
      return { provider: 'osrm', profile, points: request.points, cells };
    },

    geocode: async () => noPlaceSearch(),
    autocomplete: async () => noPlaceSearch(),
  };
}
