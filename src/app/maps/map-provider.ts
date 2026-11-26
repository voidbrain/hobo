// Framework-free map provider adapter and pure leg-cache helpers (F-007-T01).
// Kept free of Hobo domain types so src/app/maps/ can move to a shared geo package (F-012),
// and free of runtime relative imports so server/ loads it under Node's native type stripping.

/** A point on the map in WGS 84 decimal degrees. */
export interface MapPoint {
  readonly lat: number;
  readonly lng: number;
}

export const TRAVEL_PROFILES = ['driving-car', 'cycling-regular', 'foot-walking'] as const;
export type TravelProfile = (typeof TRAVEL_PROFILES)[number];
export const DEFAULT_TRAVEL_PROFILE: TravelProfile = 'driving-car';

/** Tile layer template and required visible attribution for Leaflet (F-007). */
export interface TileLayerConfig {
  readonly urlTemplate: string;
  readonly attribution: string;
  readonly maxZoom: number;
}

export const DEFAULT_OSM_TILES: TileLayerConfig = {
  urlTemplate: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '© OpenStreetMap contributors',
  maxZoom: 19,
};

export interface RouteRequest {
  readonly from: MapPoint;
  readonly to: MapPoint;
  readonly profile?: TravelProfile;
}

/** Internal distances are whole metres and travel times are whole minutes (AGENTS.md). */
export interface RouteResult {
  readonly provider: string;
  readonly profile: TravelProfile;
  readonly from: MapPoint;
  readonly to: MapPoint;
  readonly distanceMetres: number;
  readonly travelMinutes: number;
  readonly geometry: readonly MapPoint[];
  readonly cached?: boolean;
}

export interface MatrixRequest {
  readonly points: readonly MapPoint[];
  readonly profile?: TravelProfile;
}

export interface MatrixCell {
  readonly fromIndex: number;
  readonly toIndex: number;
  readonly distanceMetres: number;
  readonly travelMinutes: number;
}

export interface MatrixResult {
  readonly provider: string;
  readonly profile: TravelProfile;
  readonly points: readonly MapPoint[];
  readonly cells: readonly MatrixCell[];
}

export interface GeocodeRequest {
  readonly query: string;
  readonly limit?: number;
}

export interface GeocodeCandidate {
  readonly label: string;
  readonly location: MapPoint;
  readonly country: string | null;
  readonly region: string | null;
  readonly locality: string | null;
}

/** One swappable map, routing, matrix and geocoding adapter (F-007). */
export interface MapProvider {
  readonly id: string;
  readonly tiles: TileLayerConfig;
  route(request: RouteRequest): Promise<RouteResult>;
  matrix(request: MatrixRequest): Promise<MatrixResult>;
  geocode(request: GeocodeRequest): Promise<readonly GeocodeCandidate[]>;
  autocomplete(request: GeocodeRequest): Promise<readonly GeocodeCandidate[]>;
}

export interface LegCacheKeyParts {
  readonly provider: string;
  readonly profile: TravelProfile;
  readonly fromKey: string;
  readonly toKey: string;
}

export interface CachedLeg extends LegCacheKeyParts {
  readonly from: MapPoint;
  readonly to: MapPoint;
  readonly distanceMetres: number;
  readonly travelMinutes: number;
  readonly geometry: readonly MapPoint[];
  readonly updatedAt: string;
}

export interface LegCacheInput {
  readonly provider: string;
  readonly profile: TravelProfile;
  readonly from: MapPoint;
  readonly to: MapPoint;
  readonly distanceMetres: number;
  readonly travelMinutes: number;
  readonly geometry?: readonly MapPoint[];
}

export interface LegCache {
  getLeg(
    provider: string,
    profile: TravelProfile,
    from: MapPoint,
    to: MapPoint,
  ): CachedLeg | undefined;
  putLeg(entry: LegCacheInput): CachedLeg;
}

export type MapErrorCode =
  | 'missing_key'
  | 'invalid_key'
  | 'quota_exceeded'
  | 'unreachable_route'
  | 'upstream_error'
  | 'bad_request';

export type MapValidation<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const MATRIX_LIMITS = { minPoints: 2, maxPoints: 50 } as const;
const GEOCODE_LIMITS = { maxQueryLength: 200, defaultLimit: 5, maxLimit: 20 } as const;

function normalizeCoord(value: number, label: string, min: number, max: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${label} must be between ${min} and ${max}`);
  }
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  const zeroSafe = Object.is(rounded, -0) ? 0 : rounded;
  return zeroSafe.toFixed(6);
}

/** Rounds a provider distance or time to a whole, non-negative number (shared with `server/`). */
export function nonNegativeWhole(value: number, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative number`);
  }
  return Math.round(value);
}

function isTravelProfile(value: unknown): value is TravelProfile {
  return typeof value === 'string' && (TRAVEL_PROFILES as readonly string[]).includes(value);
}

function normalizeProviderId(provider: string): string {
  const normalized = provider.trim().toLowerCase();
  if (!normalized) {
    throw new RangeError('provider is required');
  }
  return normalized;
}

/** Canonical 6-decimal `lat,lng` coordinate key with `-0` collapsed to `0`. */
export function formatPointKey(point: MapPoint): string {
  const lat = normalizeCoord(point.lat, 'lat', -90, 90);
  const lng = normalizeCoord(point.lng, 'lng', -180, 180);
  return `${lat},${lng}`;
}

/** Normalized `(provider, profile, fromKey, toKey)` columns for the SQLite and memory leg caches. */
export function toLegCacheColumns(
  provider: string,
  profile: TravelProfile,
  from: MapPoint,
  to: MapPoint,
): LegCacheKeyParts {
  const normalizedProvider = normalizeProviderId(provider);
  if (!isTravelProfile(profile)) {
    throw new RangeError(`Unsupported travel profile: ${String(profile)}`);
  }
  return {
    provider: normalizedProvider,
    profile,
    fromKey: formatPointKey(from),
    toKey: formatPointKey(to),
  };
}

/** Collision-safe single-string key for `(provider, profile, from, to)`. */
export function legCacheKey(
  provider: string,
  profile: TravelProfile,
  from: MapPoint,
  to: MapPoint,
): string {
  const cols = toLegCacheColumns(provider, profile, from, to);
  return JSON.stringify([cols.provider, cols.profile, cols.fromKey, cols.toKey]);
}

/** Pure in-memory leg cache with the same key and geometry-preservation rules as SQLite. */
export function createMemoryLegCache(now = () => new Date().toISOString()): LegCache {
  const entries = new Map<string, CachedLeg>();
  return {
    getLeg(provider, profile, from, to) {
      return entries.get(legCacheKey(provider, profile, from, to));
    },
    putLeg(entry) {
      const cols = toLegCacheColumns(entry.provider, entry.profile, entry.from, entry.to);
      const key = JSON.stringify([cols.provider, cols.profile, cols.fromKey, cols.toKey]);
      const existing = entries.get(key);
      const incomingGeometry = entry.geometry ? [...entry.geometry] : [];
      const geometry =
        incomingGeometry.length > 0 ? incomingGeometry : (existing?.geometry ?? incomingGeometry);
      const stored: CachedLeg = {
        ...cols,
        from: { lat: entry.from.lat, lng: entry.from.lng },
        to: { lat: entry.to.lat, lng: entry.to.lng },
        distanceMetres: nonNegativeWhole(entry.distanceMetres, 'distanceMetres'),
        travelMinutes: nonNegativeWhole(entry.travelMinutes, 'travelMinutes'),
        geometry,
        updatedAt: now(),
      };
      entries.set(key, stored);
      return stored;
    },
  };
}

/** Default age after which a cached leg is fetched again (roads and timings change). */
export const DEFAULT_LEG_CACHE_MAX_AGE_DAYS = 30;

export interface CachedMapProviderOptions {
  /** A cached leg older than this is a miss; defaults to `DEFAULT_LEG_CACHE_MAX_AGE_DAYS`. */
  readonly maxAgeDays?: number;
  /** Current time in milliseconds, for tests. */
  readonly now?: () => number;
}

/**
 * Wraps any `MapProvider` so cached legs are read first on both `route` and `matrix`,
 * avoiding redundant provider calls during trip edits and what-if comparisons.
 * A leg older than `maxAgeDays` is a miss and is fetched again.
 */
export function cachedMapProvider(
  provider: MapProvider,
  cache: LegCache,
  options: CachedMapProviderOptions = {},
): MapProvider {
  const providerId = normalizeProviderId(provider.id);
  const maxAgeMs = (options.maxAgeDays ?? DEFAULT_LEG_CACHE_MAX_AGE_DAYS) * 86_400_000;
  const now = options.now ?? Date.now;
  const freshLeg = (profile: TravelProfile, from: MapPoint, to: MapPoint) => {
    const hit = cache.getLeg(providerId, profile, from, to);
    if (!hit) return undefined;
    const updated = Date.parse(hit.updatedAt);
    return Number.isFinite(updated) && now() - updated <= maxAgeMs ? hit : undefined;
  };
  return {
    id: providerId,
    tiles: provider.tiles,
    async route(request) {
      const profile = request.profile ?? DEFAULT_TRAVEL_PROFILE;
      const fromKey = formatPointKey(request.from);
      const toKey = formatPointKey(request.to);
      if (fromKey === toKey) {
        return {
          provider: providerId,
          profile,
          from: request.from,
          to: request.to,
          distanceMetres: 0,
          travelMinutes: 0,
          geometry: [],
          cached: true,
        };
      }
      const hit = freshLeg(profile, request.from, request.to);
      // A matrix-only leg has no geometry: route still asks the provider for the line.
      if (hit && hit.geometry.length > 0) {
        return {
          provider: hit.provider,
          profile: hit.profile,
          from: request.from,
          to: request.to,
          distanceMetres: hit.distanceMetres,
          travelMinutes: hit.travelMinutes,
          geometry: hit.geometry,
          cached: true,
        };
      }
      const fresh = await provider.route({ from: request.from, to: request.to, profile });
      const saved = cache.putLeg({
        provider: providerId,
        profile,
        from: request.from,
        to: request.to,
        distanceMetres: fresh.distanceMetres,
        travelMinutes: fresh.travelMinutes,
        geometry: fresh.geometry,
      });
      return {
        provider: saved.provider,
        profile: saved.profile,
        from: request.from,
        to: request.to,
        distanceMetres: saved.distanceMetres,
        travelMinutes: saved.travelMinutes,
        geometry: saved.geometry,
        cached: false,
      };
    },
    async matrix(request) {
      const profile = request.profile ?? DEFAULT_TRAVEL_PROFILE;
      const points = request.points;
      const cachedCells: MatrixCell[] = [];
      let allCached = true;

      for (let i = 0; i < points.length; i++) {
        const from = points[i]!;
        const fromKey = formatPointKey(from);
        for (let j = 0; j < points.length; j++) {
          const to = points[j]!;
          if (i === j || fromKey === formatPointKey(to)) {
            cachedCells.push({ fromIndex: i, toIndex: j, distanceMetres: 0, travelMinutes: 0 });
            continue;
          }
          const hit = freshLeg(profile, from, to);
          if (!hit) {
            allCached = false;
            break;
          }
          cachedCells.push({
            fromIndex: i,
            toIndex: j,
            distanceMetres: hit.distanceMetres,
            travelMinutes: hit.travelMinutes,
          });
        }
        if (!allCached) break;
      }

      if (allCached) {
        return {
          provider: providerId,
          profile,
          points,
          cells: cachedCells,
        };
      }

      const fresh = await provider.matrix({ points, profile });
      const normalizedCells: MatrixCell[] = fresh.cells.map((cell) => {
        const distanceMetres = nonNegativeWhole(cell.distanceMetres, 'distanceMetres');
        const travelMinutes = nonNegativeWhole(cell.travelMinutes, 'travelMinutes');
        const from = points[cell.fromIndex];
        const to = points[cell.toIndex];
        if (
          from &&
          to &&
          cell.fromIndex !== cell.toIndex &&
          formatPointKey(from) !== formatPointKey(to)
        ) {
          cache.putLeg({
            provider: providerId,
            profile,
            from,
            to,
            distanceMetres,
            travelMinutes,
          });
        }
        return {
          fromIndex: cell.fromIndex,
          toIndex: cell.toIndex,
          distanceMetres,
          travelMinutes,
        };
      });

      return {
        provider: providerId,
        profile,
        points,
        cells: normalizedCells,
      };
    },
    geocode: (request) => provider.geocode(request),
    autocomplete: (request) => provider.autocomplete(request),
  };
}

function checkPoint(value: unknown, field: string): { value: MapPoint } | { error: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { error: `${field} must have lat and lng` };
  }
  const { lat, lng, ...rest } = value as Record<string, unknown>;
  if (Object.keys(rest).length > 0) {
    return { error: `${field} has only lat and lng` };
  }
  if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90) {
    return { error: `${field} lat must be between -90 and 90` };
  }
  if (typeof lng !== 'number' || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    return { error: `${field} lng must be between -180 and 180` };
  }
  return { value: { lat, lng } };
}

function checkProfile(value: unknown): { value: TravelProfile } | { error: string } {
  if (value === undefined) return { value: DEFAULT_TRAVEL_PROFILE };
  if (isTravelProfile(value)) return { value };
  return { error: `profile must be one of ${TRAVEL_PROFILES.join(', ')}` };
}

export function validateRouteRequest(
  input: unknown,
): MapValidation<{ from: MapPoint; to: MapPoint; profile: TravelProfile }> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, errors: ['route request must be an object'] };
  }
  const obj = input as Record<string, unknown>;
  const errors: string[] = [];
  for (const key of Object.keys(obj)) {
    if (key !== 'from' && key !== 'to' && key !== 'profile') {
      errors.push(`unknown field ${key}`);
    }
  }
  const from = checkPoint(obj['from'], 'from');
  const to = checkPoint(obj['to'], 'to');
  const profile = checkProfile(obj['profile']);
  if ('error' in from) errors.push(from.error);
  if ('error' in to) errors.push(to.error);
  if ('error' in profile) errors.push(profile.error);
  if (errors.length > 0 || 'error' in from || 'error' in to || 'error' in profile) {
    return { ok: false, errors };
  }
  return { ok: true, value: { from: from.value, to: to.value, profile: profile.value } };
}

export function validateMatrixRequest(
  input: unknown,
): MapValidation<{ points: MapPoint[]; profile: TravelProfile }> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, errors: ['matrix request must be an object'] };
  }
  const obj = input as Record<string, unknown>;
  const errors: string[] = [];
  for (const key of Object.keys(obj)) {
    if (key !== 'points' && key !== 'profile') {
      errors.push(`unknown field ${key}`);
    }
  }
  const rawPoints = obj['points'];
  const points: MapPoint[] = [];
  if (!Array.isArray(rawPoints)) {
    errors.push('points must be a list');
  } else if (
    rawPoints.length < MATRIX_LIMITS.minPoints ||
    rawPoints.length > MATRIX_LIMITS.maxPoints
  ) {
    errors.push(
      `points must contain between ${MATRIX_LIMITS.minPoints} and ${MATRIX_LIMITS.maxPoints} locations`,
    );
  } else {
    for (let i = 0; i < rawPoints.length; i++) {
      const checked = checkPoint(rawPoints[i], `points[${i}]`);
      if ('error' in checked) errors.push(checked.error);
      else points.push(checked.value);
    }
  }
  const profile = checkProfile(obj['profile']);
  if ('error' in profile) errors.push(profile.error);
  if (errors.length > 0 || 'error' in profile) {
    return { ok: false, errors };
  }
  return { ok: true, value: { points, profile: profile.value } };
}

export function validateGeocodeRequest(
  input: unknown,
): MapValidation<{ query: string; limit: number }> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, errors: ['geocode request must be an object'] };
  }
  const obj = input as Record<string, unknown>;
  const errors: string[] = [];
  for (const key of Object.keys(obj)) {
    if (key !== 'query' && key !== 'limit') {
      errors.push(`unknown field ${key}`);
    }
  }
  let query = '';
  if (typeof obj['query'] !== 'string') {
    errors.push('query must be text');
  } else {
    query = obj['query'].trim();
    if (!query) errors.push('query is required');
    else if (query.length > GEOCODE_LIMITS.maxQueryLength) {
      errors.push(`query is longer than ${GEOCODE_LIMITS.maxQueryLength} characters`);
    }
  }
  let limit: number = GEOCODE_LIMITS.defaultLimit;
  if (obj['limit'] !== undefined) {
    const rawLimit = obj['limit'];
    if (
      typeof rawLimit !== 'number' ||
      !Number.isInteger(rawLimit) ||
      rawLimit < 1 ||
      rawLimit > GEOCODE_LIMITS.maxLimit
    ) {
      errors.push(`limit must be an integer between 1 and ${GEOCODE_LIMITS.maxLimit}`);
    } else {
      limit = rawLimit;
    }
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, value: { query, limit } };
}
