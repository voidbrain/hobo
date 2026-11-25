<!-- Written by tools/impact-map.mjs from the "impact" rows of .harness.json: change the rows, then run it. -->

# Impact map

What must follow a change, and what must run again after it (docs/agents/change-impact.md). `npm run check:freshness` lists, on every PR, the rows a branch sets off and the order to run them.

**More detail:** [Code coverage](coverage.md) (Unit coverage per folder, from npm run coverage)

| Id | When these change | Made of (content) | This must follow | Command | Runs again after | Checked by |
|---|---|---|---|---|---|---|
| core | `src/app/core/**` |  | Domain or routing maths changed: run the unit suite; reconcile docs/DESIGN.md once it exists (F-002-T01). | `npm test` |  | Vitest unit tests in CI |
| ui | `src/app/**/*.html`, `src/app/**/*.scss`, `src/styles.scss` |  | UI changed: read docs/STYLE-GUIDE.md; a new token or shared component updates it in the same change. | `npm run lint && npm run build` |  | ESLint template accessibility rules and the Angular build |
| work-items | `docs/work/**`, `docs/agents/model-profiles.json` |  | Regenerate the source-owned ledger (npm run work:build), then check the queue. | `npm run work:build && npm run check:work` |  | check:work, check:backlog and check:queue in CI |

## Content dependencies

What each output is made of, besides code: change one of these and the output is out of date.

| Output | Made of | Redo with |
|---|---|---|
| (none listed) | | |

## Value couplings

A value that lives in more than one place: change it in one, change it in all. Best kept by one shared source, else by a test.

| Value | Where | Kept equal by |
|---|---|---|
| (none listed) | | |

## Outside the repository

What can change an output with no commit here, and how we would notice.

| What | Affects | Noticed by |
|---|---|---|
| OpenRouteService (routing, matrix, geocoding) and OpenStreetMap tiles | Leg km and time, place search, the map | Manual check with a real key; tests use recorded fixtures (F-007) |
