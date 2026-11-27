# Hobo design

How Hobo is built: the domain model, the map provider adapter and the local service.

## Shape

```
browser (Angular app) ──/api──▶ server/ (Node 24, node:sqlite) ──▶ server/data/hobo.sqlite
                                    ▲
         src/app/core/*, src/app/maps/map-provider.ts (shared models, validation and leg-cache keys)
```

- The app reaches data and map operations only through the local service (`src/app/data/places-api.ts`, `src/app/data/trips-api.ts`, `src/app/maps/maps-api.ts`); `ng serve` proxies `/api` to it (`proxy.conf.json`). No IndexedDB store.
- The service listens on `127.0.0.1:4310` by default and answers only to local host names. It accepts JSON bodies only (`content-type: application/json`, at most 1 MB), so a cross-site page cannot post to it without a preflight it never allows.
- Settings: defaults, then `server/config.local.json` (git-ignored; see `server/config.example.json`), then `HOBO_HOST`, `HOBO_PORT`, `HOBO_DATA_DIR`, `HOBO_MAP_PROVIDER`, `HOBO_ORS_API_KEY`, `HOBO_ORS_BASE_URL`, `HOBO_ORS_TIMEOUT_MS` (default 10000), `HOBO_OSRM_BASE_URL`, `HOBO_OSRM_TIMEOUT_MS` (default 10000), `HOBO_LEG_CACHE_MAX_AGE_DAYS`. API keys never leave `server/`. The data folder (`server/data/` by default) is git-ignored.
- The server runs its TypeScript directly with Node's type stripping, so the shared model under `src/app/core/` imports other files only with `import type`.

## Place

A place is anything worth visiting, added as soon as it is found and filled in later.

| Field | Type | Empty value | Rule |
|---|---|---|---|
| `name` | text | (required) | trimmed, 1 to 200 characters |
| `description` | text | `''` | at most 10,000 characters |
| `images` | file names | `[]` | references to sanitized JPEG/PNG/WebP files in `<dataDir>/images` (EXIF/GPS stripped on import, max 5 MB per file); plain names, no paths, at most 100 |
| `category` | text or null | `null` | at most 100 characters; blank becomes null |
| `tags` | list of text | `[]` | trimmed, de-duplicated, each 1 to 50 characters, at most 50 |
| `notes` | text | `''` | at most 10,000 characters |
| `location` | `{ lat, lng }` or null | `null` | decimal degrees, lat −90 to 90, lng −180 to 180 |
| `timeSpent` | `2h`, `half-day`, `full-day` or null | `null` | time on site, queues and movement on site included: 120, 240 or 480 minutes (`timeSpentMinutes`) |

The store adds `id` (a UUID), `createdAt` and `updatedAt` (ISO timestamps). Validation (`validateNewPlace`, `validatePlacePatch`) is one pure function pair used by the service; it reports every error at once and rejects unknown fields.

## Places API

| Method and path | Body | Answer |
|---|---|---|
| `GET /api/places` | | 200, places in the order they were added |
| `POST /api/places` | a new place (a name is enough) | 201 with the place and its `location` header; 400 with `errors` |
| `GET /api/places/:id` | | 200 or 404 |
| `PATCH /api/places/:id` | the fields to change; `null` clears category, location and time spent | 200, 400 or 404 |
| `DELETE /api/places/:id` | | 204 or 404 (also unlinks unreferenced place images) |
| `POST /api/places/:id/images` | raw JPEG, PNG or WebP bytes (`<= 5 MB`) | 201 with updated place (content-sniffed by magic bytes & container structure, EXIF/GPS/XMP/comments stripped, saved under `<dataDir>/images/<uuid>.<ext>`); 400, 404, 413 (refused from `Content-Length` before the body is read) or 415 |
| `GET /api/places/:id/images/:name` | | 200 with `nosniff` and `default-src 'none'` CSP, or 404 |
| `DELETE /api/places/:id/images/:name` | | 204 or 404 |

Errors are `{ "errors": [ ... ] }`. Other answers: 405 (method), 413 (body too large), 415 (not JSON), 421 (not a local host name).

## Trip and settings

A trip (`src/app/core/trip.ts`) spans one or more calendar days (`YYYY-MM-DD`, inclusive) with a start (`from`), an end (`to`), and ordered stop references per day. Dates are calendar days with no time or time zone: the helpers count them in UTC, so the server's zone and daylight-saving changes never add or drop a day.

| Field | Type | Default on create | Rule |
|---|---|---|---|
| `name` | text | (required) | trimmed, 1 to 200 characters |
| `startDate` | `YYYY-MM-DD` | (required) | valid calendar date |
| `endDate` | `YYYY-MM-DD` | (required) | valid calendar date, `>= startDate`, at most 366 days |
| `from` | `{ name, location, placeId }` or `null` | `settings.home` | endpoint; if `placeId` is set, the place must exist |
| `to` | `{ name, location, placeId }` or `null` | `settings.home` | endpoint; if `placeId` is set, the place must exist |
| `days` | `{ date, stops }[]` | empty `stops` for each date in `[startDate..endDate]` | dates match `datesBetween(startDate, endDate)` in order; each stop is an existing `place.id` |

Pure helpers in `src/app/core/trip.ts` (`datesBetween`, `reconcileTripDays`, `addTripStop`, `removeTripStop`, `moveTripStop`, `tripPlaceIds`) keep date-range reconciliation and stop reordering in the framework-free core.

| Method and path | Body | Answer |
|---|---|---|
| `GET /api/settings` | | 200 with `{ home }` |
| `PATCH /api/settings` | `{ home }` (`TripEndpoint` or `null`) | 200 or 400 |
| `GET /api/trips` | | 200, trips in the order they were added |
| `POST /api/trips` | a new trip (`from` and `to` default to `settings.home`) | 201 with the trip and its `location` header; 400 with `errors` |
| `GET /api/trips/:id` | | 200 or 404 |
| `PATCH /api/trips/:id` | fields to change; changing `startDate`/`endDate` reconciles `days`: dates still in range keep their stops, stops on dates outside the new range are dropped | 200, 400 or 404 |
| `DELETE /api/trips/:id` | | 204 or 404 |

Deleting a place removes its `id` from stored trip stops and clears `placeId` on `from`, `to` and `settings.home` in the same SQLite transaction.

## Map provider adapter and leg cache

`src/app/maps/map-provider.ts` defines the swappable `MapProvider` contract (`route`, `matrix`, `geocode`, `autocomplete`, and tile layer defaults), request validators, canonical 6-decimal coordinate keys, and `cachedMapProvider`. Distances inside the adapter and cache are whole metres and travel times are whole minutes.

Provider implementations run in `server/` (`server/map-adapter.ts`, `server/ors-provider.ts`, `server/osrm-provider.ts`), reading `mapProvider` and `openRouteServiceApiKey` from `server/config.local.json` (or `HOBO_MAP_PROVIDER` / `HOBO_ORS_API_KEY`) and sending the OpenRouteService key only in the `Authorization` header. Cached legs live in the `leg_cache` table keyed by `(provider, profile, from_key, to_key)` so trip edits and what-if comparisons reuse known legs without re-querying the upstream provider, and matrix updates preserve previously cached route polylines. A matrix-only leg has no polyline, so `route` still fetches the line once. A leg older than `legCacheMaxAgeDays` (default 30) is a miss and is fetched again.

With `mapProvider: "osrm"` (F-013) routes and matrices come from a self-hosted OSRM at `osrmBaseUrl` (no key; unset gives `missing_key`, 503). The base URL comes only from local config, must be plain http or https (no credentials, query or fragment), and the server refuses redirects, so no request can steer it to another host. OSRM's `NoRoute` and `NoSegment` give `unreachable_route` (as ORS 2009 and 2010 do), a 429 gives `quota_exceeded`, other refusals `upstream_error` with the OSRM text in the server log only. Hobo profiles map to OSRM's `car`, `bike` and `foot`; one `osrm-routed` serves the one profile it was built with. OSRM has no place search: geocode and autocomplete answer 501 `upstream_error` until a geocoding provider exists (F-013-T02). Legs are cached under provider `osrm`, apart from ORS legs.

| Method and path | Body / query | Answer |
|---|---|---|
| `POST /api/maps/route` | `{ from, to, profile? }` | 200 with `RouteResult` (`distanceMetres`, `travelMinutes`, `geometry`, `cached`); 400, 422, 429, 502 or 503 |
| `POST /api/maps/matrix` | `{ points, profile? }` (2–50 points) | 200 with `MatrixResult`; 400, 422, 429, 502 or 503 |
| `GET /api/maps/geocode` | `?q=<text>&limit=<1..20>` | 200 with `GeocodeCandidate[]`; 400, 429, 501, 502 or 503 |
| `GET /api/maps/autocomplete` | `?q=<text>&limit=<1..20>` | 200 with `GeocodeCandidate[]`; 400, 429, 501, 502 or 503 |

Map errors include `{ code, errors }` (`missing_key`, `invalid_key`, `quota_exceeded`, `unreachable_route`, `upstream_error`, `bad_request`) and never echo provider secrets or raw provider text (other provider refusals are logged on the server). A `/api/maps` request whose `Sec-Fetch-Site` is present and not `same-origin` or `none` gets 403, so a cross-site page cannot spend the quota. Geocode and autocomplete answers are reused for 10 minutes. `MapsApi` maps them into user-facing `MapsApiError` instances.

The map itself is `MapView` (`src/app/maps/map-view.ts`, F-007-T02): Leaflet with the provider's tile layer (OpenStreetMap, no key) and visible attribution. It takes markers and route lines as inputs, emits a wrapped coordinate on map click or from its keyboard-operable centre button, and calls no service; pages pass it the `geometry` of the legs `MapsApi` answered (cached legs included). Leaflet's stylesheet loads globally from `angular.json`.

## Storage

One SQLite file, `hobo.sqlite`, in WAL mode. The `places`, `settings`, `trips` and `leg_cache` tables are `STRICT`; list/object fields (`tags`, `images`, `from_point`, `to_point`, `days`, `geometry`) are JSON text. Schema changes are numbered migrations recorded in `PRAGMA user_version`: append one, never edit one.
