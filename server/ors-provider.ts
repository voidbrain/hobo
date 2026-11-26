import {
  DEFAULT_OSM_TILES,
  DEFAULT_TRAVEL_PROFILE,
  type GeocodeCandidate,
  type GeocodeRequest,
  type MapPoint,
  type MapProvider,
  type MatrixCell,
  type MatrixRequest,
  type MatrixResult,
  type RouteRequest,
  type RouteResult,
} from '../src/app/maps/map-provider.ts';
import { MapProviderError } from './map-adapter.ts';

const DEFAULT_BASE_URL = 'https://api.openrouteservice.org';
/** How long one OpenRouteService call may take before it counts as an upstream error. */
export const DEFAULT_ORS_TIMEOUT_MS = 10_000;

export interface OrsProviderOptions {
  readonly apiKey: string | null;
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
  /** Milliseconds per call; defaults to `DEFAULT_ORS_TIMEOUT_MS`. */
  readonly timeoutMs?: number;
  /** Server-side log for upstream details the user does not see; defaults to `console.error`. */
  readonly log?: (message: string) => void;
}

function scrubSecret(message: string, secret: string): string {
  if (!secret) return message;
  return message.split(secret).join('[redacted]');
}

function secondsToWholeMinutes(seconds: number): number {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) {
    throw new MapProviderError(
      502,
      'upstream_error',
      'OpenRouteService returned an invalid duration.',
    );
  }
  return Math.round(seconds / 60);
}

function metresToWholeMetres(metres: number): number {
  if (typeof metres !== 'number' || !Number.isFinite(metres) || metres < 0) {
    throw new MapProviderError(
      502,
      'upstream_error',
      'OpenRouteService returned an invalid distance.',
    );
  }
  return Math.round(metres);
}

function parseLngLatPair(raw: unknown): MapPoint | null {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const lng = raw[0];
  const lat = raw[1];
  if (
    typeof lat !== 'number' ||
    !Number.isFinite(lat) ||
    lat < -90 ||
    lat > 90 ||
    typeof lng !== 'number' ||
    !Number.isFinite(lng) ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }
  return { lat, lng };
}

function extractOrsErrorDetail(
  payload: unknown,
  secret: string,
): { code?: number; message?: string } {
  if (typeof payload !== 'object' || payload === null) return {};
  const errField = (payload as Record<string, unknown>)['error'];
  if (typeof errField === 'string') {
    return { message: scrubSecret(errField, secret) };
  }
  if (typeof errField === 'object' && errField !== null) {
    const obj = errField as Record<string, unknown>;
    return {
      code: typeof obj['code'] === 'number' ? obj['code'] : undefined,
      message: typeof obj['message'] === 'string' ? scrubSecret(obj['message'], secret) : undefined,
    };
  }
  return {};
}

/** ORS directions error codes for "route not found" (2009) and "routable point not found" (2010). */
const ORS_NO_ROUTE_CODES: ReadonlySet<number> = new Set([2009, 2010]);

function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
}

function timeoutError(timeoutMs: number): MapProviderError {
  return new MapProviderError(
    502,
    'upstream_error',
    `OpenRouteService did not answer within ${Math.ceil(timeoutMs / 1000)} s. Try again.`,
  );
}

async function callOrsJson(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  apiKey: string,
  timeoutMs: number,
  log: (message: string) => void,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    if (isTimeout(error)) throw timeoutError(timeoutMs);
    throw new MapProviderError(
      502,
      'upstream_error',
      'Could not reach OpenRouteService. Check your network connection and try again.',
    );
  }

  let parsed: unknown = null;
  try {
    parsed = await response.json();
  } catch (error) {
    if (isTimeout(error)) throw timeoutError(timeoutMs);
    if (response.ok) {
      throw new MapProviderError(
        502,
        'upstream_error',
        'OpenRouteService returned malformed JSON.',
      );
    }
  }

  if (response.ok) {
    return parsed;
  }

  const detail = extractOrsErrorDetail(parsed, apiKey);
  if (response.status === 429) {
    throw new MapProviderError(
      429,
      'quota_exceeded',
      'OpenRouteService rate or daily quota limit reached. Routes and matrices whose legs are all cached still work; anything with a new leg waits until the limit resets.',
    );
  }
  if (response.status === 401 || response.status === 403) {
    throw new MapProviderError(
      502,
      'invalid_key',
      'OpenRouteService rejected the API key. Check openRouteServiceApiKey in server/config.local.json.',
    );
  }
  if (detail.code !== undefined && ORS_NO_ROUTE_CODES.has(detail.code)) {
    throw new MapProviderError(
      422,
      'unreachable_route',
      'OpenRouteService could not find a route for the given locations.',
    );
  }
  // Other refusals (bad parameters, limits, server faults): the ORS text stays in the server log.
  log(
    `OpenRouteService ${response.status}${detail.code === undefined ? '' : ` code ${detail.code}`}: ${detail.message ?? 'no message'}`,
  );
  throw new MapProviderError(
    502,
    'upstream_error',
    `OpenRouteService refused the request (status ${response.status}).`,
  );
}

function parsePeliasFeatures(payload: unknown): GeocodeCandidate[] {
  if (typeof payload !== 'object' || payload === null) {
    throw new MapProviderError(
      502,
      'upstream_error',
      'OpenRouteService returned an invalid geocode payload.',
    );
  }
  const features = (payload as Record<string, unknown>)['features'];
  if (!Array.isArray(features)) {
    throw new MapProviderError(
      502,
      'upstream_error',
      'OpenRouteService returned no geocode features.',
    );
  }
  const results: GeocodeCandidate[] = [];
  for (const feature of features) {
    if (typeof feature !== 'object' || feature === null) continue;
    const fObj = feature as Record<string, unknown>;
    const geom =
      typeof fObj['geometry'] === 'object' && fObj['geometry'] !== null
        ? (fObj['geometry'] as Record<string, unknown>)
        : undefined;
    const location = parseLngLatPair(geom?.['coordinates']);
    const props =
      typeof fObj['properties'] === 'object' && fObj['properties'] !== null
        ? (fObj['properties'] as Record<string, unknown>)
        : undefined;
    const labelRaw = props?.['label'] ?? props?.['name'];
    if (!location || typeof labelRaw !== 'string' || !labelRaw.trim()) continue;
    results.push({
      label: labelRaw.trim(),
      location,
      country: typeof props?.['country'] === 'string' ? props['country'] : null,
      region: typeof props?.['region'] === 'string' ? props['region'] : null,
      locality: typeof props?.['locality'] === 'string' ? props['locality'] : null,
    });
  }
  return results;
}

/** OpenRouteService adapter running exclusively inside `server/` (F-007-T03). */
export function createOpenRouteServiceProvider(options: OrsProviderOptions): MapProvider {
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_ORS_TIMEOUT_MS;
  const log = options.log ?? ((message: string) => console.error(message));

  function requireKey(): string {
    const key = options.apiKey?.trim() ?? '';
    if (!key) {
      throw new MapProviderError(
        503,
        'missing_key',
        'OpenRouteService API key is not configured. Add openRouteServiceApiKey to server/config.local.json.',
      );
    }
    return key;
  }

  async function runGeocode(
    path: string,
    request: GeocodeRequest,
  ): Promise<readonly GeocodeCandidate[]> {
    const apiKey = requireKey();
    const limit = request.limit ?? 5;
    const url = `${baseUrl}${path}?text=${encodeURIComponent(request.query.trim())}&size=${encodeURIComponent(String(limit))}`;
    const payload = await callOrsJson(
      fetchImpl,
      url,
      {
        method: 'GET',
        headers: {
          authorization: apiKey,
          accept: 'application/json',
        },
      },
      apiKey,
      timeoutMs,
      log,
    );
    return parsePeliasFeatures(payload);
  }

  return {
    id: 'openrouteservice',
    tiles: DEFAULT_OSM_TILES,
    async route(request: RouteRequest): Promise<RouteResult> {
      const apiKey = requireKey();
      const profile = request.profile ?? DEFAULT_TRAVEL_PROFILE;
      const url = `${baseUrl}/v2/directions/${encodeURIComponent(profile)}/geojson`;
      const payload = await callOrsJson(
        fetchImpl,
        url,
        {
          method: 'POST',
          headers: {
            authorization: apiKey,
            accept: 'application/geo+json, application/json',
            'content-type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify({
            coordinates: [
              [request.from.lng, request.from.lat],
              [request.to.lng, request.to.lat],
            ],
          }),
        },
        apiKey,
        timeoutMs,
        log,
      );

      if (typeof payload !== 'object' || payload === null) {
        throw new MapProviderError(
          502,
          'upstream_error',
          'OpenRouteService returned an invalid route.',
        );
      }
      const features = (payload as Record<string, unknown>)['features'];
      const first =
        Array.isArray(features) && typeof features[0] === 'object' && features[0] !== null
          ? (features[0] as Record<string, unknown>)
          : undefined;
      if (!first) {
        throw new MapProviderError(
          422,
          'unreachable_route',
          'No route found between the selected locations.',
        );
      }
      const props =
        typeof first['properties'] === 'object' && first['properties'] !== null
          ? (first['properties'] as Record<string, unknown>)
          : undefined;
      const summary =
        typeof props?.['summary'] === 'object' && props['summary'] !== null
          ? (props['summary'] as Record<string, unknown>)
          : undefined;
      const distanceMetres = metresToWholeMetres(summary?.['distance'] as number);
      const travelMinutes = secondsToWholeMinutes(summary?.['duration'] as number);

      const geom =
        typeof first['geometry'] === 'object' && first['geometry'] !== null
          ? (first['geometry'] as Record<string, unknown>)
          : undefined;
      const rawCoords = Array.isArray(geom?.['coordinates']) ? geom['coordinates'] : [];
      const geometry: MapPoint[] = [];
      for (const pair of rawCoords) {
        const pt = parseLngLatPair(pair);
        if (pt) geometry.push(pt);
      }

      return {
        provider: 'openrouteservice',
        profile,
        from: request.from,
        to: request.to,
        distanceMetres,
        travelMinutes,
        geometry,
      };
    },

    async matrix(request: MatrixRequest): Promise<MatrixResult> {
      const apiKey = requireKey();
      const profile = request.profile ?? DEFAULT_TRAVEL_PROFILE;
      const url = `${baseUrl}/v2/matrix/${encodeURIComponent(profile)}`;
      const payload = await callOrsJson(
        fetchImpl,
        url,
        {
          method: 'POST',
          headers: {
            authorization: apiKey,
            accept: 'application/json',
            'content-type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify({
            locations: request.points.map((p) => [p.lng, p.lat]),
            metrics: ['distance', 'duration'],
            units: 'm',
          }),
        },
        apiKey,
        timeoutMs,
        log,
      );

      if (typeof payload !== 'object' || payload === null) {
        throw new MapProviderError(
          502,
          'upstream_error',
          'OpenRouteService returned an invalid matrix.',
        );
      }
      const obj = payload as Record<string, unknown>;
      const distances = obj['distances'];
      const durations = obj['durations'];
      const count = request.points.length;
      if (
        !Array.isArray(distances) ||
        !Array.isArray(durations) ||
        distances.length !== count ||
        durations.length !== count
      ) {
        throw new MapProviderError(
          502,
          'upstream_error',
          'OpenRouteService matrix dimensions did not match the requested locations.',
        );
      }

      const cells: MatrixCell[] = [];
      for (let i = 0; i < count; i++) {
        const distRow = distances[i];
        const durRow = durations[i];
        if (
          !Array.isArray(distRow) ||
          !Array.isArray(durRow) ||
          distRow.length !== count ||
          durRow.length !== count
        ) {
          throw new MapProviderError(
            502,
            'upstream_error',
            'OpenRouteService matrix row dimensions did not match.',
          );
        }
        for (let j = 0; j < count; j++) {
          const dist = distRow[j];
          const dur = durRow[j];
          if (dist === null || dur === null) {
            throw new MapProviderError(
              422,
              'unreachable_route',
              'One or more locations could not be connected by route.',
            );
          }
          cells.push({
            fromIndex: i,
            toIndex: j,
            distanceMetres: metresToWholeMetres(dist as number),
            travelMinutes: secondsToWholeMinutes(dur as number),
          });
        }
      }

      return {
        provider: 'openrouteservice',
        profile,
        points: request.points,
        cells,
      };
    },

    geocode: (request) => runGeocode('/geocode/search', request),
    autocomplete: (request) => runGeocode('/geocode/autocomplete', request),
  };
}
