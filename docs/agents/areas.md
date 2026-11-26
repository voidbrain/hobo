# Hobo area notes

Detailed rules and lessons for each part of the project, kept out of AGENTS.md so that file stays short. Read the section of the area you change before you change it; AGENTS.md applies to every task. Keep this file current like AGENTS.md: a change that alters a rule here updates it in the same PR.

## Domain core

- Code: `src/app/core/` (places, trips, legs, totals, what-if, variants). Plain TypeScript: no Angular imports except the signal primitives `.harness.json` allows (`conventions.pureDirs`; ESLint enforces it too).
- Every computation is a pure function with a unit test next to it (`*.spec.ts`). Totals (F-004): travel A→B, then stay at B, then B→C, and so on; the home or start point has no stay.
- Times are whole minutes, distances metres; formatting to `km` and `h min` happens only at the edge (`formatMinutes`).
- Test data is invented: made-up place names and coordinates, never the owner's real places or home.

## Map and routing providers

- Code: `src/app/maps/` (planned, F-007): one `MapProvider` interface (routing, matrix, geocoding/autocomplete, tiles); OpenRouteService first, self-hosted OSRM and Nominatim or Photon later, Google optional.
- Components and the domain core never call a provider directly; they go through the adapter, so a provider swap touches one folder.
- Leg results are cached by (provider, profile, from, to); a what-if never re-queries a cached leg.
- Routing, matrix and geocoding providers run in `server/`; the app reaches them through the local API. API keys come from `server/config.local.json` (git-ignored) or a local env, never from git, `public/` or the browser. Tests use recorded fixtures, never a live provider.
- The maps/geo layer is a candidate shared package with openbando (Leaflet plus its own geo maths in `src/app/core/geo.ts` there): keep it free of Hobo types so it can move (Hobo's own F-012).

## UI

- Code: `src/app/` components and pages, `src/styles.scss` tokens. Read [docs/agents/angular.md](angular.md) and the [style guide](../STYLE-GUIDE.md) first.
- Components stay thin: state and derivations in signals over `core/` functions.
- Shared components are written for 🧱 bricks (coordinator coordinator:F-012; Hobo's F-010 tracks the move): inputs and outputs only, tokens only, no app services.

## Storage

- Code: `server/`: a small Node 24 service with SQLite (`node:sqlite`) on the owner's machine, run by Node's type stripping (`npm run server`); the Angular app talks to it through one client service (`src/app/data/places-api.ts`). Tests: `npm run test:server` (`node --test`), each over a temporary data folder. The shared model in `src/app/core/` imports other files only with `import type`, or Node cannot load it. It also hosts the NERV MCP server (F-011), share links (F-008) and the provider keys. IndexedDB only as an optional offline cache later. No hosted multi-user backend at first.
- Place images live in the git-ignored server data folder, never in git; GPS metadata is stripped on import (F-002-T03).

## NERV integration

- Code: `server/` (planned, F-011): an MCP endpoint on the local service exposing places, trips and route totals, like Grover's hub.
- The tool surface gets a table in `docs/DESIGN.md` when F-011 builds it; a change to it updates that table and tells NERV's pack owner.
