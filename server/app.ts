import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join, resolve, sep } from 'node:path';
import { PLACE_LIMITS, validateNewPlace, validatePlacePatch } from '../src/app/core/place.ts';
import {
  tripPlaceIds,
  validateNewTrip,
  validateSettingsPatch,
  validateTripPatch,
} from '../src/app/core/trip.ts';
import {
  DEFAULT_LEG_CACHE_MAX_AGE_DAYS,
  validateGeocodeRequest,
  validateMatrixRequest,
  validateRouteRequest,
  type MapProvider,
} from '../src/app/maps/map-provider.ts';
import type { ServerConfig } from './config.ts';
import { MAX_IMAGE_BYTES, mimeForImageName, sanitizeImage } from './images.ts';
import { createServerMapProvider } from './map-adapter.ts';
import {
  createOpenRouteServiceProvider,
  DEFAULT_ORS_TIMEOUT_MS,
  MapProviderError,
} from './ors-provider.ts';
import { openPlaceStore, type PlaceStore } from './store.ts';

const MAX_BODY = 1_000_000;
// The service answers only to local host names, so a web page cannot reach it through DNS rebinding.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const SAFE_IMAGE_NAME = /^[A-Za-z0-9_-][A-Za-z0-9._-]{0,127}$/;

class HttpError extends Error {
  readonly status: number;
  readonly errors: string[];
  readonly code?: string;
  constructor(status: number, errors: string[], code?: string) {
    super(errors.join('; '));
    this.status = status;
    this.errors = errors;
    this.code = code;
  }
}

function send(
  res: ServerResponse,
  status: number,
  body?: unknown,
  headers: Record<string, string> = {},
) {
  if (body === undefined) {
    res.writeHead(status, headers).end();
    return;
  }
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(body));
}

// A JSON content type forces a browser to preflight a cross-site request, which this service never allows.
async function readJson(req: IncomingMessage): Promise<unknown> {
  if (!/^application\/json\b/i.test(req.headers['content-type'] ?? ''))
    throw new HttpError(415, ['send JSON with content-type application/json']);
  const chunks: Buffer[] = [];
  let size = 0;
  // An oversized body is read to its end but not kept, so the client gets the 413 instead of a broken pipe.
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size <= MAX_BODY) chunks.push(chunk);
  }
  if (size > MAX_BODY) throw new HttpError(413, [`the body is larger than ${MAX_BODY} bytes`]);
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, ['the body is not valid JSON']);
  }
}

// Only non-CORS-safelisted binary content types are accepted, forcing a CORS preflight on cross-site pages.
async function readBinaryImage(req: IncomingMessage): Promise<Buffer> {
  const ct = (req.headers['content-type'] ?? '').split(';')[0]!.trim().toLowerCase();
  if (
    ct !== 'image/jpeg' &&
    ct !== 'image/png' &&
    ct !== 'image/webp' &&
    ct !== 'application/octet-stream'
  ) {
    throw new HttpError(415, [
      'send binary image bytes with content-type image/jpeg, image/png, image/webp or application/octet-stream',
    ]);
  }
  // A body announced over the limit gets its 413 before any of it is read or kept; the rest is
  // discarded as it arrives, so the client reads the answer instead of a broken pipe.
  const declared = Number(req.headers['content-length']);
  if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) {
    req.resume();
    throw new HttpError(413, [`image is larger than ${MAX_IMAGE_BYTES} bytes`]);
  }
  // A body without a length (chunked) is read to its end, but nothing past the limit is kept.
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size <= MAX_IMAGE_BYTES) chunks.push(chunk);
  }
  if (size > MAX_IMAGE_BYTES) {
    throw new HttpError(413, [`image is larger than ${MAX_IMAGE_BYTES} bytes`]);
  }
  return Buffer.concat(chunks);
}

function decodeSegment(raw: string | undefined, missingLabel: string): string | undefined {
  if (!raw) return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    throw new HttpError(404, [missingLabel]);
  }
}

function resolveImageFile(imagesDir: string, name: string): string {
  if (!SAFE_IMAGE_NAME.test(name)) throw new HttpError(404, ['no such image']);
  const root = resolve(imagesDir);
  const full = resolve(root, name);
  if (!full.startsWith(root + sep)) throw new HttpError(404, ['no such image']);
  return full;
}

function unlinkIfUnreferenced(store: PlaceStore, imagesDir: string | undefined, names: string[]) {
  if (!imagesDir || names.length === 0) return;
  const stillReferenced = new Set(store.list().flatMap((p) => p.images));
  for (const name of names) {
    if (stillReferenced.has(name) || !SAFE_IMAGE_NAME.test(name)) continue;
    const file = resolve(imagesDir, name);
    if (file.startsWith(resolve(imagesDir) + sep) && existsSync(file)) {
      try {
        unlinkSync(file);
      } catch {
        // Ignore concurrent removal
      }
    }
  }
}

function assertPlacesExist(store: PlaceStore, ids: readonly string[]) {
  const missing = store.unknownPlaceIds(ids);
  if (missing.length) {
    throw new HttpError(
      400,
      missing.map((id) => `unknown place id ${id}`),
    );
  }
}

function parseGeocodeQuery(url: URL) {
  const query = url.searchParams.get('q') ?? url.searchParams.get('query') ?? '';
  const rawLimit = url.searchParams.get('limit');
  const limit = rawLimit === null ? undefined : Number(rawLimit);
  return validateGeocodeRequest(limit === undefined ? { query } : { query, limit });
}

/** The local API: /api/places (with /:id/images), /api/settings, /api/trips and /api/maps. */
export function placesHandler(store: PlaceStore, imagesDir?: string, maps?: MapProvider) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const host = (req.headers.host ?? '').replace(/:\d+$/, '').toLowerCase();
      if (!LOCAL_HOSTS.has(host))
        throw new HttpError(421, ['this service answers only on localhost']);
      const url = new URL(req.url ?? '/', 'http://localhost');
      const path = url.pathname;

      if (maps && path.startsWith('/api/maps/')) {
        // A GET needs no preflight, so a cross-site page could spend the provider quota.
        const site = req.headers['sec-fetch-site'];
        if (site !== undefined && site !== 'same-origin' && site !== 'none')
          throw new HttpError(403, ['map requests come only from the Hobo app']);
        if (/^\/api\/maps\/route\/?$/.test(path)) {
          if (req.method !== 'POST') throw new HttpError(405, ['use POST']);
          const checked = validateRouteRequest(await readJson(req));
          if (!checked.ok) throw new HttpError(400, checked.errors, 'bad_request');
          return send(res, 200, await maps.route(checked.value));
        }
        if (/^\/api\/maps\/matrix\/?$/.test(path)) {
          if (req.method !== 'POST') throw new HttpError(405, ['use POST']);
          const checked = validateMatrixRequest(await readJson(req));
          if (!checked.ok) throw new HttpError(400, checked.errors, 'bad_request');
          return send(res, 200, await maps.matrix(checked.value));
        }
        if (/^\/api\/maps\/geocode\/?$/.test(path)) {
          if (req.method !== 'GET') throw new HttpError(405, ['use GET']);
          const checked = parseGeocodeQuery(url);
          if (!checked.ok) throw new HttpError(400, checked.errors, 'bad_request');
          return send(res, 200, await maps.geocode(checked.value));
        }
        if (/^\/api\/maps\/autocomplete\/?$/.test(path)) {
          if (req.method !== 'GET') throw new HttpError(405, ['use GET']);
          const checked = parseGeocodeQuery(url);
          if (!checked.ok) throw new HttpError(400, checked.errors, 'bad_request');
          return send(res, 200, await maps.autocomplete(checked.value));
        }
        throw new HttpError(404, ['no such path']);
      }

      const imageMatch = /^\/api\/places\/([^/]+)\/images(?:\/([^/]+))?\/?$/.exec(path);
      if (imageMatch && imagesDir) {
        const id = decodeSegment(imageMatch[1], 'no such place')!;
        const imageName = decodeSegment(imageMatch[2], 'no such image');
        const place = store.get(id);
        if (!place) throw new HttpError(404, ['no such place']);

        if (!imageName) {
          if (req.method !== 'POST') throw new HttpError(405, ['use POST']);
          if (place.images.length >= PLACE_LIMITS.images) {
            throw new HttpError(400, [`more than ${PLACE_LIMITS.images} images`]);
          }
          const raw = await readBinaryImage(req);
          const sanitized = sanitizeImage(raw);
          if (!sanitized.ok) throw new HttpError(sanitized.status, [sanitized.error]);

          mkdirSync(imagesDir, { recursive: true });
          const storedName = `${randomUUID()}.${sanitized.ext}`;
          writeFileSync(resolveImageFile(imagesDir, storedName), sanitized.data);
          const updated = store.update(id, { images: [...place.images, storedName] });
          if (!updated) throw new HttpError(404, ['no such place']);
          return send(res, 201, updated, {
            location: `/api/places/${encodeURIComponent(id)}/images/${encodeURIComponent(storedName)}`,
          });
        }

        if (!place.images.includes(imageName)) throw new HttpError(404, ['no such image']);
        const filePath = resolveImageFile(imagesDir, imageName);

        if (req.method === 'GET') {
          const mime = mimeForImageName(imageName);
          if (!mime || !existsSync(filePath)) throw new HttpError(404, ['no such image']);
          const bytes = readFileSync(filePath);
          res.writeHead(200, {
            'content-type': mime,
            'content-length': String(bytes.length),
            'x-content-type-options': 'nosniff',
            'content-security-policy': "default-src 'none'",
            'cache-control': 'private, max-age=31536000, immutable',
          });
          res.end(bytes);
          return;
        }

        if (req.method === 'DELETE') {
          store.update(id, { images: place.images.filter((n) => n !== imageName) });
          unlinkIfUnreferenced(store, imagesDir, [imageName]);
          return send(res, 204);
        }

        throw new HttpError(405, ['use GET or DELETE']);
      }

      const placesMatch = /^\/api\/places(?:\/([^/]+))?\/?$/.exec(path);
      if (placesMatch) {
        const id = decodeSegment(placesMatch[1], 'no such place');
        if (!id) {
          if (req.method === 'GET') return send(res, 200, store.list());
          if (req.method !== 'POST') throw new HttpError(405, ['use GET or POST']);
          const checked = validateNewPlace(await readJson(req));
          if (!checked.ok) throw new HttpError(400, checked.errors);
          const place = store.create(checked.value);
          return send(res, 201, place, { location: `/api/places/${encodeURIComponent(place.id)}` });
        }
        if (req.method === 'GET') {
          const place = store.get(id);
          if (!place) throw new HttpError(404, ['no such place']);
          return send(res, 200, place);
        }
        if (req.method === 'PATCH') {
          const checked = validatePlacePatch(await readJson(req));
          if (!checked.ok) throw new HttpError(400, checked.errors);
          const place = store.update(id, checked.value);
          if (!place) throw new HttpError(404, ['no such place']);
          return send(res, 200, place);
        }
        if (req.method === 'DELETE') {
          const existing = store.get(id);
          if (!existing || !store.remove(id)) throw new HttpError(404, ['no such place']);
          unlinkIfUnreferenced(store, imagesDir, existing.images);
          return send(res, 204);
        }
        throw new HttpError(405, ['use GET, PATCH or DELETE']);
      }

      if (/^\/api\/settings\/?$/.test(path)) {
        if (req.method === 'GET') return send(res, 200, store.getSettings());
        if (req.method === 'PATCH') {
          const checked = validateSettingsPatch(await readJson(req));
          if (!checked.ok) throw new HttpError(400, checked.errors);
          if (checked.value.home?.placeId) {
            assertPlacesExist(store, [checked.value.home.placeId]);
          }
          return send(res, 200, store.updateSettings(checked.value));
        }
        throw new HttpError(405, ['use GET or PATCH']);
      }

      const tripsMatch = /^\/api\/trips(?:\/([^/]+))?\/?$/.exec(path);
      if (tripsMatch) {
        const id = decodeSegment(tripsMatch[1], 'no such trip');
        if (!id) {
          if (req.method === 'GET') return send(res, 200, store.listTrips());
          if (req.method !== 'POST') throw new HttpError(405, ['use GET or POST']);
          const checked = validateNewTrip(await readJson(req), store.getSettings().home);
          if (!checked.ok) throw new HttpError(400, checked.errors);
          assertPlacesExist(store, tripPlaceIds(checked.value));
          const trip = store.createTrip(checked.value);
          return send(res, 201, trip, { location: `/api/trips/${encodeURIComponent(trip.id)}` });
        }
        if (req.method === 'GET') {
          const trip = store.getTrip(id);
          if (!trip) throw new HttpError(404, ['no such trip']);
          return send(res, 200, trip);
        }
        if (req.method === 'PATCH') {
          const body = await readJson(req);
          const current = store.getTrip(id);
          if (!current) throw new HttpError(404, ['no such trip']);
          const checked = validateTripPatch(body, current);
          if (!checked.ok) throw new HttpError(400, checked.errors);
          const merged = { ...current, ...checked.value };
          assertPlacesExist(store, tripPlaceIds(merged));
          const updated = store.updateTrip(id, checked.value);
          if (!updated) throw new HttpError(404, ['no such trip']);
          return send(res, 200, updated);
        }
        if (req.method === 'DELETE') {
          if (!store.removeTrip(id)) throw new HttpError(404, ['no such trip']);
          return send(res, 204);
        }
        throw new HttpError(405, ['use GET, PATCH or DELETE']);
      }

      throw new HttpError(404, ['no such path']);
    } catch (error) {
      if (error instanceof MapProviderError) {
        return send(res, error.status, { code: error.code, errors: [error.userMessage] });
      }
      if (error instanceof HttpError) {
        return send(
          res,
          error.status,
          error.code ? { code: error.code, errors: error.errors } : { errors: error.errors },
        );
      }
      console.error(error);
      return send(res, 500, { errors: ['internal error'] });
    }
  };
}

export interface RunningServer {
  url: string;
  close(): Promise<void>;
}

export type StartServerConfig = Pick<ServerConfig, 'host' | 'port' | 'dataDir'> &
  Partial<Omit<ServerConfig, 'host' | 'port' | 'dataDir'>> & {
    fetchImpl?: typeof fetch;
  };

/** Opens the store in the data folder (created if missing) and listens. */
export async function startServer(config: StartServerConfig): Promise<RunningServer> {
  mkdirSync(config.dataDir, { recursive: true });
  const store = openPlaceStore(join(config.dataDir, 'hobo.sqlite'));
  const resolvedConfig: ServerConfig = {
    host: config.host,
    port: config.port,
    dataDir: config.dataDir,
    mapProvider: config.mapProvider ?? 'openrouteservice',
    openRouteServiceApiKey: config.openRouteServiceApiKey ?? null,
    openRouteServiceBaseUrl: config.openRouteServiceBaseUrl ?? 'https://api.openrouteservice.org',
    openRouteServiceTimeoutMs: config.openRouteServiceTimeoutMs ?? DEFAULT_ORS_TIMEOUT_MS,
    legCacheMaxAgeDays: config.legCacheMaxAgeDays ?? DEFAULT_LEG_CACHE_MAX_AGE_DAYS,
  };
  const mapProvider = createServerMapProvider(resolvedConfig, store, {
    openrouteservice: (cfg) =>
      createOpenRouteServiceProvider({
        apiKey: cfg.openRouteServiceApiKey,
        baseUrl: cfg.openRouteServiceBaseUrl,
        fetchImpl: config.fetchImpl,
        timeoutMs: cfg.openRouteServiceTimeoutMs,
      }),
  });
  const server = createServer(placesHandler(store, join(config.dataDir, 'images'), mapProvider));
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, config.host, resolve);
  });
  const { port } = server.address() as AddressInfo;
  const host = config.host.includes(':') ? `[${config.host}]` : config.host;
  return {
    url: `http://${host}:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => {
          store.close();
          if (error) reject(error);
          else resolve();
        });
      }),
  };
}
