# Hobo 🗺️

Hobo is a personal trip planner. Add places as you find them (name, description, images, category, tags, notes, location and time on site), then filter and group them by category and tag and manage those values. Delete unused places after confirmation; places used by trips are protected. Build trips from places: dates, a start and an end (home by default), and stops in order. Hobo computes kilometres and time per leg, per day and for the whole trip, lets you try another order or set of stops without touching the saved plan, and keeps variants of a trip side by side. Data stays on your own machine.

Status: scaffold. The plan, in steps with estimates, is the [backlog](docs/BACKLOG.md).

## Run it

```bash
npm ci
npm run server       # the local data service on http://127.0.0.1:4310
npm start            # http://localhost:4200, /api proxied to the service
npm test             # app unit tests, then the server tests
npm run build        # dist/hobo/browser
```

Node 24 or later. Data and API keys stay on your machine in a small local Node 24 service with SQLite (`server/`, data in the git-ignored `server/data/`); the app talks to it. Settings go in `server/config.local.json` (git-ignored; see `server/config.example.json`). How it fits together: [design](docs/DESIGN.md). The OpenRouteService key goes in `server/config.local.json` (git-ignored), never in `public/`, so it never reaches the browser (F-007).

Place search uses OpenRouteService. Copy `server/config.example.json` to `server/config.local.json`, set `openRouteServiceApiKey` to your key, and restart the local server. The local OSRM provider does not provide place search. Keep the key in the ignored local config; do not commit it.

## Where things are

```
src/app/core/     framework-free domain code (place model, time on site, totals, what-if), unit-tested
src/app/data/     the client service that talks to the local server
server/           local Node 24 service with SQLite: places API, data folder, config
src/app/pages/    routed pages (lazy)
src/styles.scss   design tokens (colour, type, spacing)
docs/             backlog, rules, style guide, audits, archives
docs/work/        backlog record sources and steps (npm run work:build writes docs/BACKLOG.md)
tools/            harness checks (backlog, freshness, conventions, coverage)
```

## Working on it

- [AGENTS.md](AGENTS.md): how to work in this repository (for people and coding agents), with per-area rules in [docs/agents/areas.md](docs/agents/areas.md).
- [docs/BACKLOG.md](docs/BACKLOG.md): current bugs and features, with their status and next action ([rules](docs/BACKLOG-RULES.md)).
- [docs/STYLE-GUIDE.md](docs/STYLE-GUIDE.md): how the product looks and talks.
