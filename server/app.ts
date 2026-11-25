import { mkdirSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { validateNewPlace, validatePlacePatch } from '../src/app/core/place.ts';
import {
  tripPlaceIds,
  validateNewTrip,
  validateSettingsPatch,
  validateTripPatch,
} from '../src/app/core/trip.ts';
import type { ServerConfig } from './config.ts';
import { openPlaceStore, type PlaceStore } from './store.ts';

const MAX_BODY = 1_000_000;
// The service answers only to local host names, so a web page cannot reach it through DNS rebinding.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

class HttpError extends Error {
  readonly status: number;
  readonly errors: string[];
  constructor(status: number, errors: string[]) {
    super(errors.join('; '));
    this.status = status;
    this.errors = errors;
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

function decodeSegment(raw: string | undefined, missingLabel: string): string | undefined {
  if (!raw) return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    throw new HttpError(404, [missingLabel]);
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

/** The local API: /api/places, /api/settings and /api/trips. */
export function placesHandler(store: PlaceStore) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const host = (req.headers.host ?? '').replace(/:\d+$/, '').toLowerCase();
      if (!LOCAL_HOSTS.has(host))
        throw new HttpError(421, ['this service answers only on localhost']);
      const path = new URL(req.url ?? '/', 'http://localhost').pathname;

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
          if (!store.remove(id)) throw new HttpError(404, ['no such place']);
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
      if (error instanceof HttpError) {
        return send(res, error.status, { errors: error.errors });
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

/** Opens the store in the data folder (created if missing) and listens. */
export async function startServer(config: ServerConfig): Promise<RunningServer> {
  mkdirSync(config.dataDir, { recursive: true });
  const store = openPlaceStore(join(config.dataDir, 'hobo.sqlite'));
  const server = createServer(placesHandler(store));
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
