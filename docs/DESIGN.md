# Hobo design

How Hobo is built: the domain model and the local service. Routing maths, the map provider adapter and the NERV MCP surface join this page as they are built.

## Shape

```
browser (Angular app) ──/api──▶ server/ (Node 24, node:sqlite) ──▶ server/data/hobo.sqlite
                                    ▲
                     src/app/core/place.ts (shared model and validation)
```

- The app reaches data only through the local service (`src/app/data/places-api.ts`); `ng serve` proxies `/api` to it (`proxy.conf.json`). No IndexedDB store.
- The service listens on `127.0.0.1:4310` by default and answers only to local host names. It accepts JSON bodies only (`content-type: application/json`, at most 1 MB), so a cross-site page cannot post to it without a preflight it never allows.
- Settings: defaults, then `server/config.local.json` (git-ignored; see `server/config.example.json`), then `HOBO_HOST`, `HOBO_PORT`, `HOBO_DATA_DIR`. The data folder (`server/data/` by default) is git-ignored.
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
| `POST /api/places/:id/images` | raw JPEG, PNG or WebP bytes (`<= 5 MB`) | 201 with updated place (content-sniffed by magic bytes & container structure, EXIF/GPS/XMP/comments stripped, saved under `<dataDir>/images/<uuid>.<ext>`); 400, 404, 413 or 415 |
| `GET /api/places/:id/images/:name` | | 200 with `nosniff` and `default-src 'none'` CSP, or 404 |
| `DELETE /api/places/:id/images/:name` | | 204 or 404 |

Errors are `{ "errors": [ ... ] }`. Other answers: 405 (method), 413 (body too large), 415 (not JSON), 421 (not a local host name).

## Storage

One SQLite file, `hobo.sqlite`, in WAL mode. The `places` table is `STRICT`, one column per field; `tags` and `images` are JSON text. Schema changes are numbered migrations recorded in `PRAGMA user_version`: append one, never edit one.
