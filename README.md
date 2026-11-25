# Hobo 🗺️

Hobo is a personal trip planner. Add places as you find them (name, description, images, category, tags, notes, location and time on site), organise them later by category and tag, then build trips from them: dates, a start and an end (home by default), and stops in order. Hobo computes kilometres and time per leg, per day and for the whole trip, lets you try another order or set of stops without touching the saved plan, and keeps variants of a trip side by side. Data stays on your own machine.

Status: scaffold. The plan, in steps with estimates, is the [backlog](docs/BACKLOG.md).

## Run it

```bash
npm ci
npm start            # http://localhost:4200
npm test
npm run build        # dist/hobo/browser
```

Node 24 or later. Data and API keys stay on your machine in a small local Node 24 service with SQLite (`server/`, planned in F-002-T01); the app talks to it. The OpenRouteService key goes in `server/config.local.json` (git-ignored), never in `public/`, so it never reaches the browser (F-007).

## Where things are

```
src/app/core/     framework-free domain code (time on site, totals, what-if), unit-tested
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
