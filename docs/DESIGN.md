# Hobo design

How Hobo is built: the domain model and the local service. Routing maths, the map provider adapter and the NERV MCP surface join this page as they are built.

## Shape

```
browser (Angular app) ──/api──▶ server/ (Node 24, node:sqlite) ──▶ server/data/hobo.sqlite
                                    ▲
         src/app/core/place.ts, src/app/core/trip.ts (shared models and validation)
```

- The app reaches data only through the local service (`src/app/data/places-api.ts`, `src/app/data/trips-api.ts`); `ng serve` proxies `/api` to it (`proxy.conf.json`). No IndexedDB store.
- The service listens on `127.0.0.1:4310` by default and answers only to local host names. It accepts JSON bodies only (`content-type: application/json`, at most 1 MB), so a cross-site page cannot post to it without a preflight it never allows.
- Settings: defaults, then `server/config.local.json` (git-ignored; see `server/config.example.json`), then `HOBO_HOST`, `HOBO_PORT`, `HOBO_DATA_DIR`. The data folder (`server/data/` by default) is git-ignored.
- The server runs its TypeScript directly with Node's type stripping, so the shared model under `src/app/core/` imports other files only with `import type`.

## Place

A place is anything worth visiting, added as soon as it is found and filled in later.

| Field | Type | Empty value | Rule |
|---|---|---|---|
| `name` | text | (required) | trimmed, 1 to 200 characters |
| `description` | text | `''` | at most 10,000 characters |
| `images` | file names | `[]` | references to files in the data folder (upload and EXIF stripping arrive with images); plain names, no paths, at most 100 |
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
| `DELETE /api/places/:id` | | 204 or 404 |

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

## Storage

One SQLite file, `hobo.sqlite`, in WAL mode. The `places`, `settings` and `trips` tables are `STRICT`; list/object fields (`tags`, `images`, `from_point`, `to_point`, `days`) are JSON text. Schema changes are numbered migrations recorded in `PRAGMA user_version`: append one, never edit one.
