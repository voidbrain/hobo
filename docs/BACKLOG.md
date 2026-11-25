# <a id="top"></a>Hobo backlog

Current work ledger, reviewed 25 November 2026 against main `17b2ce3`. Generated from [record sources](work/records) and [steps](work/tasks) by `npm run work:build`: edit those, not this file. [Rules](BACKLOG-RULES.md) · [Archive](archive/README.md) · [Reading the records](#how-to-use-this-file).

<!-- totals:start -->
**Remaining effort:** 53.75 h agent + 2.5 h owner across 35 open steps of 14 features. Generated from the task files.
<!-- totals:end -->

## Work items

Bugs (B-) and features (F-) in one list, in work-queue order. Steps: `effort` = remaining agent time (🟢 up to 1 h · 🟡 4 h · 🔴 8 h · 🟣 more); `h` = agent hours, owner time apart; a step status is not the record's acceptance.

### <a id="f-007"></a>[✨ F-007](#top)

**Map provider adapter: Leaflet and OpenRouteService**

| Status | Priority | Effort | Remaining | Depends on | Unlocks | Agent | Procedures | Decisions |
|---|---|---|---|---|---|:---:|:---:|:---:|
| 🔴 Open | 🔶 P2 | 🔴 Large | 7 h agent + 0.25 h owner | [F-002-T01](#f-002-t01) | [F-002-T04](#f-002-t04), [F-004-T02](#f-004-t02), [F-004-T03](#f-004-t03), [F-012-T01](#f-012-t01), [F-013-T01](#f-013-t01), [F-013-T02](#f-013-t02) | ⏳ | — | — |

💻 **→** Next: F-007-T01 — Adapter interface, local config and leg cache (Planned).

| | |
|---|---|
| **Issue** | Maps, routing, the distance/time matrix and geocoding go through one adapter, so providers can change. Start with Leaflet (OpenStreetMap tiles) and OpenRouteService (routing, matrix, geocoding and autocomplete, free key). Leg results are cached so what-if comparisons do not re-query. Routing and geocoding calls go through `server/`, which holds the key in git-ignored `server/config.local.json`; the key never reaches `public/` or the browser. |
| **Reproduce** | There is no map and no routing. |
| **Check** | One `MapProvider` interface; an OpenRouteService implementation tested against recorded fixtures; a Leaflet map component with attribution; a leg cache keyed by provider, profile, from and to; the key read only by `server/` from git-ignored `server/config.local.json`; a live route works with the owner's key. |

**Feature steps**

| Effort | Step | Estimate | Actual | Remaining | Status | Depends on | Unlocks | Who |
|---|---|---|---|---|---|---|---|:---:|
| 🟡 Medium | <a id="f-007-t01"></a>F-007-T01 — Adapter interface, local config and leg cache | 2 h | 0 h | 2 h | Planned | [F-002-T01](#f-002-t01) | [F-007-T02](#f-007-t02), [F-007-T03](#f-007-t03), [F-013-T01](#f-013-t01), [F-013-T02](#f-013-t02) | ⏳ 🤖 |
| 🟡 Medium | <a id="f-007-t02"></a>F-007-T02 — Leaflet map component | 2 h | 0 h | 2 h | Planned | [F-007-T01](#f-007-t01) | [F-002-T04](#f-002-t04), [F-004-T03](#f-004-t03), [F-012-T01](#f-012-t01) | ⏳ 🤖 |
| 🟡 Medium | <a id="f-007-t03"></a>F-007-T03 — OpenRouteService provider | 3 h | 0 h | 3 h | Planned | [F-007-T01](#f-007-t01) | [F-002-T04](#f-002-t04), [F-004-T02](#f-004-t02), [F-007-T04](#f-007-t04) | ⏳ 🤖 |
| 🟢 Small | <a id="f-007-t04"></a>F-007-T04 — Owner adds an OpenRouteService key and checks a live route | 0 h | 0 h | 0 h agent + 0.25 h owner | Planned | [F-007-T03](#f-007-t03) | — | ⏳ 🧑‍🔧 |
| 🔴 Large | **Total** | 7 h | 0 h (0 of 4 steps recorded) | 7 h agent + 0.25 h owner | 0 of 4 completed | | | |

<details>
<summary>Next action, estimates and PR history</summary>

[Full notes & evidence](work/records/F-007.md)

| Field | Value |
|---|---|
| PR / evidence | [#1](https://github.com/voidbrain/hobo/pull/1); [#2](https://github.com/voidbrain/hobo/pull/2) (review fixes) |
| Opened | 2026-11-25 |
| Verification | Pending |
| Reviewed | 2026-11-25 |

</details>

---
### <a id="f-002"></a>[✨ F-002](#top)

**Places: collect and organise**

| Status | Priority | Effort | Remaining | Depends on | Unlocks | Agent | Procedures | Decisions |
|---|---|---|---|---|---|:---:|:---:|:---:|
| 🔴 Open | 🔶 P2 | 🟣 Very large | 8.5 h | [F-007-T02](#f-007-t02), [F-007-T03](#f-007-t03) | [F-003-T01](#f-003-t01), [F-003-T02](#f-003-t02), [F-007-T01](#f-007-t01), [F-011-T01](#f-011-t01) | 🤖 | — | — |

💻 **→** Next: F-002-T01 — Local store service and place model (Implemented; verification pending).

| | |
|---|---|
| **Issue** | Places are added at random as they are found, then organised. Each place has a name, description, images, category, tags, notes, a location and the time spent on site (2 h, half day or full day, queues and movement on site included). Data stays on the owner's own machine or base: a small Node 24 `server/` with SQLite (`node:sqlite`) that the Angular app talks to; it also serves the NERV MCP server (F-011), share links (F-008) and keeps API keys off the client. IndexedDB is at most an optional offline cache later. No hosted multi-user backend. |
| **Reproduce** | Open Hobo: there is no way to add a place yet. |
| **Check** | A place can be added with only a name, then edited to fill every field; images are stored locally with GPS metadata stripped; places can be filtered and grouped by category and tag; data survives a restart and never enters git. |

**Feature steps**

| Effort | Step | Estimate | Actual | Remaining | Status | Depends on | Unlocks |
|---|---|---|---|---|---|---|---|
| 🟢 Small | <a id="f-002-t01"></a>F-002-T01 — Local store service and place model | 3 h | 0 h | 0 h | Implemented; verification pending | — | [F-002-T02](#f-002-t02), [F-002-T03](#f-002-t03), [F-003-T01](#f-003-t01), [F-007-T01](#f-007-t01), [F-011-T01](#f-011-t01) |
| 🟡 Medium | <a id="f-002-t02"></a>F-002-T02 — Place list and form | 2.5 h | 0 h | 2.5 h | Planned | [F-002-T01](#f-002-t01) | [F-002-T04](#f-002-t04), [F-002-T05](#f-002-t05), [F-003-T02](#f-003-t02) |
| 🟡 Medium | <a id="f-002-t03"></a>F-002-T03 — Place images | 2 h | 0 h | 2 h | Planned | [F-002-T01](#f-002-t01) | — |
| 🟡 Medium | <a id="f-002-t04"></a>F-002-T04 — Place location | 2 h | 0 h | 2 h | Planned | [F-002-T02](#f-002-t02), [F-007-T02](#f-007-t02), [F-007-T03](#f-007-t03) | — |
| 🟡 Medium | <a id="f-002-t05"></a>F-002-T05 — Categories and tags | 2 h | 0 h | 2 h | Planned | [F-002-T02](#f-002-t02) | — |
| 🟣 Very large | **Total** | 11.5 h | 0 h (0 of 5 steps recorded) | 8.5 h | 0 of 5 completed | | |

<details>
<summary>Next action, estimates and PR history</summary>

[Full notes & evidence](work/records/F-002.md)

| Field | Value |
|---|---|
| PR / evidence | Steps: F-002-T01: step review: 2026-11-25 design-reviewer (fresh context, Opus): no blockers; fixed a 500 on a malformed id escape (test first) and added a rollback to a failed migration. Project-only harness edits: package.json (type module, server scripts; npm test also runs the server tests) and a marked CI step.. [#1](https://github.com/voidbrain/hobo/pull/1); [#2](https://github.com/voidbrain/hobo/pull/2) (review fixes); [#5](https://github.com/voidbrain/hobo/pull/5) |
| Opened | 2026-11-25 |
| Verification | Pending |
| Reviewed | 2026-11-25 |

</details>

---
### <a id="f-003"></a>[✨ F-003](#top)

**Trips: dates, start and end, stops**

| Status | Priority | Effort | Remaining | Depends on | Unlocks | Agent | Procedures | Decisions |
|---|---|---|---|---|---|:---:|:---:|:---:|
| 🔴 Open | 🔶 P2 | 🔴 Large | 7 h | [F-002-T01](#f-002-t01), [F-002-T02](#f-002-t02) | [F-004-T02](#f-004-t02), [F-006-T01](#f-006-t01), [F-008-T04](#f-008-t04), [F-011-T01](#f-011-t01) | ⏳ | — | — |

💻 **→** Next: F-003-T01 — Trip model and API (Planned).

| | |
|---|---|
| **Issue** | A trip has dates (a single day or several), a start and an end (home by default) and stops, picked from places or added on the fly. |
| **Reproduce** | There is no trip yet. |
| **Check** | A trip can be created for one or more days; from and to default to the home set in settings and can be changed; stops are picked from places or created on the fly (which adds a place); stops can be reordered and moved between days. |

**Feature steps**

| Effort | Step | Estimate | Actual | Remaining | Status | Depends on | Unlocks |
|---|---|---|---|---|---|---|---|
| 🟡 Medium | <a id="f-003-t01"></a>F-003-T01 — Trip model and API | 2 h | 0 h | 2 h | Planned | [F-002-T01](#f-002-t01) | [F-003-T02](#f-003-t02), [F-006-T01](#f-006-t01), [F-008-T04](#f-008-t04), [F-011-T01](#f-011-t01) |
| 🟡 Medium | <a id="f-003-t02"></a>F-003-T02 — Trip editor | 3 h | 0 h | 3 h | Planned | [F-003-T01](#f-003-t01), [F-002-T02](#f-002-t02) | [F-003-T03](#f-003-t03), [F-004-T02](#f-004-t02) |
| 🟡 Medium | <a id="f-003-t03"></a>F-003-T03 — Reorder stops and move them between days | 2 h | 0 h | 2 h | Planned | [F-003-T02](#f-003-t02) | — |
| 🔴 Large | **Total** | 7 h | 0 h (0 of 3 steps recorded) | 7 h | 0 of 3 completed | | |

<details>
<summary>Next action, estimates and PR history</summary>

[Full notes & evidence](work/records/F-003.md)

| Field | Value |
|---|---|
| PR / evidence | [#1](https://github.com/voidbrain/hobo/pull/1) |
| Opened | 2026-11-25 |
| Verification | Pending |
| Reviewed | 2026-11-25 |

</details>

---
### <a id="f-004"></a>[✨ F-004](#top)

**Routing totals per leg, per day and per trip**

| Status | Priority | Effort | Remaining | Depends on | Unlocks | Agent | Procedures | Decisions |
|---|---|---|---|---|---|:---:|:---:|:---:|
| 🔴 Open | 🔶 P2 | 🔴 Large | 4.25 h | [F-003-T02](#f-003-t02), [F-007-T03](#f-007-t03), [F-007-T02](#f-007-t02) | [F-005-T01](#f-005-t01), [F-006-T02](#f-006-t02), [F-008-T01](#f-008-t01), [F-008-T02](#f-008-t02), [F-008-T04](#f-008-t04), [F-011-T01](#f-011-t01) | 🤖 | — | — |

💻 **→** Next: F-004-T01 — Pure totals (Implemented; verification pending).

| | |
|---|---|
| **Issue** | For a trip, Hobo shows km and time per leg and in total, filtered by one day, several days or the whole trip. Time is A→B travel + time at B + B→C travel and so on; home and the end point have no stay. |
| **Reproduce** | A trip with stops shows no distance or time. |
| **Check** | Each leg shows km and travel time; each day and the selected days show km, travel time, time on site and total; the whole trip shows the same; numbers match a hand calculation on an invented trip. |

**Feature steps**

| Effort | Step | Estimate | Actual | Remaining | Status | Depends on | Unlocks | PRs |
|---|---|---|---|---|---|---|---|---|
| 🟢 Small | <a id="f-004-t01"></a>F-004-T01 — Pure totals | 1.5 h | 0 h | 0.25 h | Implemented; verification pending | — | [F-004-T02](#f-004-t02), [F-011-T01](#f-011-t01) | [PR #4](https://github.com/voidbrain/hobo/pull/4) pure route totals in src/app/core/route-totals.ts |
| 🟡 Medium | <a id="f-004-t02"></a>F-004-T02 — Legs through the adapter | 2 h | 0 h | 2 h | Planned | [F-004-T01](#f-004-t01), [F-003-T02](#f-003-t02), [F-007-T03](#f-007-t03) | [F-004-T03](#f-004-t03), [F-005-T01](#f-005-t01), [F-008-T01](#f-008-t01), [F-011-T01](#f-011-t01) | — |
| 🟡 Medium | <a id="f-004-t03"></a>F-004-T03 — Day filter, summary and route on the map | 2 h | 0 h | 2 h | Planned | [F-004-T02](#f-004-t02), [F-007-T02](#f-007-t02) | [F-006-T02](#f-006-t02), [F-008-T02](#f-008-t02), [F-008-T04](#f-008-t04) | — |
| 🔴 Large | **Total** | 5.5 h | 0 h (0 of 3 steps recorded) | 4.25 h | 0 of 3 completed | | | |

<details>
<summary>Next action, estimates and PR history</summary>

[Full notes & evidence](work/records/F-004.md)

| Field | Value |
|---|---|
| PR / evidence | Steps: F-004-T01: [PR #4](https://github.com/voidbrain/hobo/pull/4) pure route totals in src/app/core/route-totals.ts. [#1](https://github.com/voidbrain/hobo/pull/1); [#4](https://github.com/voidbrain/hobo/pull/4) |
| Opened | 2026-11-25 |
| Verification | Unit/integration: 2026-11-25 passed locally (`src/app/core/route-totals.spec.ts`); adapter/UI steps pending. |
| Reviewed | 2026-11-25 |

</details>

---
### <a id="f-001"></a>[✨ F-001](#top)

**Angular scaffold and project harness**

| Status | Priority | Effort | Remaining | Depends on | Unlocks | Agent | Procedures | Decisions |
|---|---|---|---|---|---|:---:|:---:|:---:|
| 🟡 Implemented | 🔶 P2 | 🟢 Small | 0 h | — | — | 🤖 | — | — |

💻 **→** Next: F-001-T01 — Scaffold the app and apply harness v10.21.3 (Implemented; verification pending).

| | |
|---|---|
| **Issue** | Hobo needs an Angular 22 app (standalone components, signals, strict TypeScript and templates) and the 🦺 project harness (core + angular) before feature work starts. Approved by the owner on 2026-11-25. |
| **Reproduce** | `npm ci && npm run check:fast && npm test && npm run build` on a fresh clone. |
| **Check** | The first PR's CI (`check` job) is green: harness checks, lint, format, unit tests with coverage, type check and build. Branch protection and auto-merge are set by the owner. |

**Feature steps**

| Effort | Step | Estimate | Actual | Remaining | Status | Who | PRs |
|---|---|---|---|---|---|:---:|---|
| 🟢 Small | <a id="f-001-t01"></a>F-001-T01 — Scaffold the app and apply harness v10.21.3 | 3 h | 0 h | 0 h | Implemented; verification pending | 🤖 | [PR #1](https://github.com/voidbrain/hobo/pull/1) scaffold and harness |
| 🟢 Small | **Total** | 3 h | 0 h (0 of 2 steps recorded) | 0 h | 1 of 2 completed | | |

<details><summary>Done steps (1)</summary>

| Effort | Step | Estimate | Actual | Status | PRs |
|---|---|---|---|---|---|
| — | <a id="f-001-t02"></a>F-001-T02 — Owner sets branch protection and auto-merge | 0 h | 0 h | Completed | — |

</details>

<details>
<summary>Next action, estimates and PR history</summary>

[Full notes & evidence](work/records/F-001.md)

| Field | Value |
|---|---|
| PR / evidence | Steps: F-001-T01: [PR #1](https://github.com/voidbrain/hobo/pull/1) scaffold and harness. [#1](https://github.com/voidbrain/hobo/pull/1); [#3](https://github.com/voidbrain/hobo/pull/3) |
| Opened | 2026-11-25 |
| Verification | Pending |
| Reviewed | 2026-11-25 |

</details>

---
### <a id="f-008"></a>[✨ F-008](#top)

**Share and export**

| Status | Priority | Effort | Remaining | Depends on | Unlocks | Agent | Procedures | Decisions |
|---|---|---|---|---|---|:---:|:---:|:---:|
| 🔴 Open | 🔹 P3 | 🔴 Large | 6.5 h agent + 0.5 h owner | [F-004-T02](#f-004-t02), [F-004-T03](#f-004-t03), [F-003-T01](#f-003-t01) | [F-009-T01](#f-009-t01) | ⏳ | — | 🤔 |

🧑 **→** Next: [🤔](work/records/F-008.md) F-008-T03 — Owner decides how a read-only link is served (Ready).

| | |
|---|---|
| **Issue** | A trip can be exported (GPX and KML for navigation apps, PDF for print) and shared as a read-only link. There is no hosted backend, so how a share link is served is the owner's decision. |
| **Reproduce** | A trip cannot leave Hobo. |
| **Check** | GPX and KML files open in a GPX viewer and Google Earth with the stops and the route; a PDF itinerary lists days, stops, legs and totals; a read-only link shows the trip without editing. |

**Feature steps**

| Effort | Step | Estimate | Actual | Remaining | Status | Depends on | Unlocks | Who |
|---|---|---|---|---|---|---|---|:---:|
| 🟢 Small | <a id="f-008-t03"></a>F-008-T03 — Owner decides how a read-only link is served | 0 h | 0 h | 0 h agent + 0.5 h owner | Ready | — | [F-008-T04](#f-008-t04) | [🤔](work/records/F-008.md) |
| 🟡 Medium | <a id="f-008-t01"></a>F-008-T01 — GPX and KML export | 2 h | 0 h | 2 h | Planned | [F-004-T02](#f-004-t02) | — | ⏳ 🤖 |
| 🟡 Medium | <a id="f-008-t02"></a>F-008-T02 — PDF itinerary | 2 h | 0 h | 2 h | Planned | [F-004-T03](#f-004-t03) | — | ⏳ 🤖 |
| 🟡 Medium | <a id="f-008-t04"></a>F-008-T04 — Read-only share link | 2.5 h | 0 h | 2.5 h | Planned | [F-008-T03](#f-008-t03), [F-003-T01](#f-003-t01), [F-004-T03](#f-004-t03) | [F-009-T01](#f-009-t01) | ⏳ 🤖 |
| 🔴 Large | **Total** | 6.5 h | 0 h (0 of 4 steps recorded) | 6.5 h agent + 0.5 h owner | 0 of 4 completed | | | |

<details>
<summary>Next action, estimates and PR history</summary>

[Full notes & evidence](work/records/F-008.md)

| Field | Value |
|---|---|
| PR / evidence | [#1](https://github.com/voidbrain/hobo/pull/1); [#2](https://github.com/voidbrain/hobo/pull/2) (review fixes) |
| Opened | 2026-11-25 |
| Verification | Pending |
| Reviewed | 2026-11-25 |

</details>

---
### <a id="f-009"></a>[✨ F-009](#top)

**Multi-user editing (deferred)**

| Status | Priority | Effort | Remaining | Depends on | Unlocks | Agent | Procedures | Decisions |
|---|---|---|---|---|---|:---:|:---:|:---:|
| 🔴 Open | 🔹 P3 | 🟢 Small | 0.25 h owner | [F-008-T04](#f-008-t04) | — | — | — | — |

💻 **→** Next: F-009-T01 — Owner decides whether and when to plan multi-user editing (Planned).

| | |
|---|---|
| **Issue** | Editing a trip with others is wanted later, not now. It needs a hosted or shared backend, which Hobo deliberately does not have at first. |
| **Reproduce** | — |
| **Check** | The owner decides whether and when to build it, after share and export (F-008); then this record gets its step plan. |

**Feature steps**

| Effort | Step | Estimate | Actual | Remaining | Status | Depends on | Unlocks | Who |
|---|---|---|---|---|---|---|---|:---:|
| 🟢 Small | <a id="f-009-t01"></a>F-009-T01 — Owner decides whether and when to plan multi-user editing | 0 h | 0 h | 0 h agent + 0.25 h owner | Planned | [F-008-T04](#f-008-t04) | — | ⏳ 🤔 |
| 🟢 Small | **Total** | 0 h | 0 h (0 of 1 steps recorded) | 0.25 h owner | 0 of 1 completed | | | |

<details>
<summary>Next action, estimates and PR history</summary>

[Full notes & evidence](work/records/F-009.md)

| Field | Value |
|---|---|
| PR / evidence | [#1](https://github.com/voidbrain/hobo/pull/1) |
| Opened | 2026-11-25 |
| Verification | Pending |
| Reviewed | 2026-11-25 |

</details>

---
### <a id="f-012"></a>[✨ F-012](#top)

**Shared maps/geo package with openbando (candidate)**

| Status | Priority | Effort | Remaining | Depends on | Unlocks | Agent | Procedures | Decisions |
|---|---|---|---|---|---|:---:|:---:|:---:|
| 🔴 Open | 🔹 P3 | 🟢 Small | 1 h | [F-007-T02](#f-007-t02) | — | ⏳ | — | — |

💻 **→** Next: F-012-T01 — Compare and propose (Planned).

| | |
|---|---|
| **Issue** | The maps and geo domain is shared with openbando, which uses Leaflet and its own geo maths in `src/app/core/geo.ts`. A shared package could serve both. This is a candidate, not a decision. |
| **Reproduce** | — |
| **Check** | A dated comparison of Hobo's `src/app/maps/` and openbando's geo code lists the shared functions and proposes a package and its owner, raised with the coordinator; or the record closes with the reason not to share. |

**Feature steps**

| Effort | Step | Estimate | Actual | Remaining | Status | Depends on | Unlocks |
|---|---|---|---|---|---|---|---|
| 🟢 Small | <a id="f-012-t01"></a>F-012-T01 — Compare and propose | 1 h | 0 h | 1 h | Planned | [F-007-T02](#f-007-t02) | — |
| 🟢 Small | **Total** | 1 h | 0 h (0 of 1 steps recorded) | 1 h | 0 of 1 completed | | |

<details>
<summary>Next action, estimates and PR history</summary>

[Full notes & evidence](work/records/F-012.md)

| Field | Value |
|---|---|
| PR / evidence | [#1](https://github.com/voidbrain/hobo/pull/1) |
| Opened | 2026-11-25 |
| Verification | Pending |
| Reviewed | 2026-11-25 |

</details>

---
### <a id="f-005"></a>[✨ F-005](#top)

**What-if: compare another order or set of stops**

| Status | Priority | Effort | Remaining | Depends on | Unlocks | Agent | Procedures | Decisions |
|---|---|---|---|---|---|:---:|:---:|:---:|
| 🔴 Open | 🔹 P3 | 🟡 Medium | 4 h | [F-004-T02](#f-004-t02) | — | ⏳ | — | — |

💻 **→** Next: F-005-T01 — Pure what-if evaluation (Planned).

| | |
|---|---|
| **Issue** | Before changing a plan, the owner wants to try another order or a different set of stops (for example A, C, D instead of A, B, C, D) and see km and time, without changing the saved plan, then choose. |
| **Reproduce** | Reordering stops changes the saved trip immediately. |
| **Check** | A scratch copy can be reordered or have stops toggled; km and time are compared with the saved plan using cached legs (only missing pairs are queried, in one matrix call); the owner applies or discards it; the saved plan is untouched until applied. |

**Feature steps**

| Effort | Step | Estimate | Actual | Remaining | Status | Depends on | Unlocks |
|---|---|---|---|---|---|---|---|
| 🟡 Medium | <a id="f-005-t01"></a>F-005-T01 — Pure what-if evaluation | 1.5 h | 0 h | 1.5 h | Planned | [F-004-T02](#f-004-t02) | [F-005-T02](#f-005-t02) |
| 🟡 Medium | <a id="f-005-t02"></a>F-005-T02 — What-if panel | 2.5 h | 0 h | 2.5 h | Planned | [F-005-T01](#f-005-t01) | — |
| 🟡 Medium | **Total** | 4 h | 0 h (0 of 2 steps recorded) | 4 h | 0 of 2 completed | | |

<details>
<summary>Next action, estimates and PR history</summary>

[Full notes & evidence](work/records/F-005.md)

| Field | Value |
|---|---|
| PR / evidence | [#1](https://github.com/voidbrain/hobo/pull/1) |
| Opened | 2026-11-25 |
| Verification | Pending |
| Reviewed | 2026-11-25 |

</details>

---
### <a id="f-006"></a>[✨ F-006](#top)

**Variants: tabs per trip for A/B testing**

| Status | Priority | Effort | Remaining | Depends on | Unlocks | Agent | Procedures | Decisions |
|---|---|---|---|---|---|:---:|:---:|:---:|
| 🔴 Open | 🔹 P3 | 🟡 Medium | 3.5 h | [F-003-T01](#f-003-t01), [F-004-T03](#f-004-t03) | — | ⏳ | — | — |

💻 **→** Next: F-006-T01 — Variant model (Planned).

| | |
|---|---|
| **Issue** | A trip can hold several variants, shown as tabs, to compare alternative plans. |
| **Reproduce** | A trip has one plan only. |
| **Check** | A variant can be created by duplicating the current one, renamed and deleted; tabs switch between them; totals of the variants can be compared side by side. |

**Feature steps**

| Effort | Step | Estimate | Actual | Remaining | Status | Depends on | Unlocks |
|---|---|---|---|---|---|---|---|
| 🟡 Medium | <a id="f-006-t01"></a>F-006-T01 — Variant model | 1.5 h | 0 h | 1.5 h | Planned | [F-003-T01](#f-003-t01) | [F-006-T02](#f-006-t02) |
| 🟡 Medium | <a id="f-006-t02"></a>F-006-T02 — Variant tabs and comparison | 2 h | 0 h | 2 h | Planned | [F-006-T01](#f-006-t01), [F-004-T03](#f-004-t03) | — |
| 🟡 Medium | **Total** | 3.5 h | 0 h (0 of 2 steps recorded) | 3.5 h | 0 of 2 completed | | |

<details>
<summary>Next action, estimates and PR history</summary>

[Full notes & evidence](work/records/F-006.md)

| Field | Value |
|---|---|
| PR / evidence | [#1](https://github.com/voidbrain/hobo/pull/1) |
| Opened | 2026-11-25 |
| Verification | Pending |
| Reviewed | 2026-11-25 |

</details>

---
### <a id="f-010"></a>[✨ F-010](#top)

**Shared UI built to move to 🧱 bricks**

| Status | Priority | Effort | Remaining | Depends on | Unlocks | Agent | Procedures | Decisions |
|---|---|---|---|---|---|:---:|:---:|:---:|
| 🔴 Open | 🔹 P3 | 🟡 Medium | 3.5 h | — | — | 🤖 | — | — |

💻 **→** Next: F-010-T01 — Bricks-ready contract and check (Ready).

| | |
|---|---|
| **Issue** | Shared components should come from 🧱 bricks (coordinator solution:F-012), the planned shared UI library voidbrain/bricks. Until it exists, Hobo builds its shared components so they can move there unchanged. |
| **Reproduce** | — |
| **Check** | Shared components live in `src/app/shared/`, take inputs and outputs only, use tokens only and inject no app service, and a lint rule enforces it; once bricks exists, they move there and Hobo imports them. |

**Feature steps**

| Effort | Step | Estimate | Actual | Remaining | Status | Depends on | Unlocks |
|---|---|---|---|---|---|---|---|
| 🟡 Medium | <a id="f-010-t01"></a>F-010-T01 — Bricks-ready contract and check | 1.5 h | 0 h | 1.5 h | Ready | — | [F-010-T02](#f-010-t02) |
| 🟡 Medium | <a id="f-010-t02"></a>F-010-T02 — Move shared components to bricks | 2 h | 0 h | 2 h | Planned | [F-010-T01](#f-010-t01) | — |
| 🟡 Medium | **Total** | 3.5 h | 0 h (0 of 2 steps recorded) | 3.5 h | 0 of 2 completed | | |

<details>
<summary>Next action, estimates and PR history</summary>

[Full notes & evidence](work/records/F-010.md)

| Field | Value |
|---|---|
| PR / evidence | [#1](https://github.com/voidbrain/hobo/pull/1); [#2](https://github.com/voidbrain/hobo/pull/2) (review fixes) |
| Opened | 2026-11-25 |
| Verification | Pending |
| Reviewed | 2026-11-25 |

</details>

---
### <a id="f-011"></a>[✨ F-011](#top)

**NERV integration: MCP server for places, trips and totals**

| Status | Priority | Effort | Remaining | Depends on | Unlocks | Agent | Procedures | Decisions |
|---|---|---|---|---|---|:---:|:---:|:---:|
| 🔴 Open | 🔹 P3 | 🟡 Medium | 2.5 h agent + 0.25 h owner | [F-002-T01](#f-002-t01), [F-003-T01](#f-003-t01), [F-004-T01](#f-004-t01), [F-004-T02](#f-004-t02) | — | ⏳ | — | — |

💻 **→** Next: F-011-T01 — MCP endpoint in the local service (Planned).

| | |
|---|---|
| **Issue** | NERV should read Hobo the way it reads Grover's hub: an MCP server exposing places, trips and route totals. |
| **Reproduce** | NERV cannot see Hobo. |
| **Check** | The local service exposes an MCP endpoint with read tools (list places, get a trip, route totals for a trip, a day or the whole trip); an end-to-end test lists and calls the tools; NERV answers a question about a trip from chat. |

**Feature steps**

| Effort | Step | Estimate | Actual | Remaining | Status | Depends on | Unlocks | Who |
|---|---|---|---|---|---|---|---|:---:|
| 🟡 Medium | <a id="f-011-t01"></a>F-011-T01 — MCP endpoint in the local service | 2.5 h | 0 h | 2.5 h | Planned | [F-002-T01](#f-002-t01), [F-003-T01](#f-003-t01), [F-004-T01](#f-004-t01), [F-004-T02](#f-004-t02) | [F-011-T02](#f-011-t02) | ⏳ 🤖 |
| 🟢 Small | <a id="f-011-t02"></a>F-011-T02 — Owner connects Hobo to NERV and checks it from chat | 0 h | 0 h | 0 h agent + 0.25 h owner | Planned | [F-011-T01](#f-011-t01) | — | ⏳ 🧑‍🔧 |
| 🟡 Medium | **Total** | 2.5 h | 0 h (0 of 2 steps recorded) | 2.5 h agent + 0.25 h owner | 0 of 2 completed | | | |

<details>
<summary>Next action, estimates and PR history</summary>

[Full notes & evidence](work/records/F-011.md)

| Field | Value |
|---|---|
| PR / evidence | [#1](https://github.com/voidbrain/hobo/pull/1); [#2](https://github.com/voidbrain/hobo/pull/2) (review fixes) |
| Opened | 2026-11-25 |
| Verification | Pending |
| Reviewed | 2026-11-25 |

</details>

---
### <a id="f-013"></a>[✨ F-013](#top)

**Self-hosted routing and geocoding (later)**

| Status | Priority | Effort | Remaining | Depends on | Unlocks | Agent | Procedures | Decisions |
|---|---|---|---|---|---|:---:|:---:|:---:|
| 🔴 Open | 🔹 P3 | 🟡 Medium | 4 h agent + 1 h owner | [F-007-T01](#f-007-t01) | — | ⏳ | — | — |

💻 **→** Next: F-013-T01 — OSRM provider (Planned).

| | |
|---|---|
| **Issue** | Later, routing and the matrix come from a self-hosted OSRM, and geocoding from Nominatim or Photon, on the owner's base, to drop the API key and quota. |
| **Reproduce** | — |
| **Check** | OSRM and Nominatim or Photon providers implement the adapter, pass the same fixture tests as OpenRouteService, and the owner's base serves them. |

**Feature steps**

| Effort | Step | Estimate | Actual | Remaining | Status | Depends on | Unlocks | Who |
|---|---|---|---|---|---|---|---|:---:|
| 🟡 Medium | <a id="f-013-t01"></a>F-013-T01 — OSRM provider | 2 h | 0 h | 2 h | Planned | [F-007-T01](#f-007-t01) | [F-013-T03](#f-013-t03) | ⏳ 🤖 |
| 🟡 Medium | <a id="f-013-t02"></a>F-013-T02 — Nominatim or Photon geocoding provider | 2 h | 0 h | 2 h | Planned | [F-007-T01](#f-007-t01) | [F-013-T03](#f-013-t03) | ⏳ 🤖 |
| 🟢 Small | <a id="f-013-t03"></a>F-013-T03 — Owner runs OSRM and Photon on the base | 0 h | 0 h | 0 h agent + 1 h owner | Planned | [F-013-T01](#f-013-t01), [F-013-T02](#f-013-t02) | — | ⏳ 🧑‍🔧 |
| 🟡 Medium | **Total** | 4 h | 0 h (0 of 3 steps recorded) | 4 h agent + 1 h owner | 0 of 3 completed | | | |

<details>
<summary>Next action, estimates and PR history</summary>

[Full notes & evidence](work/records/F-013.md)

| Field | Value |
|---|---|
| PR / evidence | [#1](https://github.com/voidbrain/hobo/pull/1) |
| Opened | 2026-11-25 |
| Verification | Pending |
| Reviewed | 2026-11-25 |

</details>

---
### <a id="f-014"></a>[✨ F-014](#top)

**Google Maps place data (optional, later)**

| Status | Priority | Effort | Remaining | Depends on | Unlocks | Agent | Procedures | Decisions |
|---|---|---|---|---|---|:---:|:---:|:---:|
| 🔴 Open | 🔹 P3 | 🟡 Medium | 2 h agent + 0.25 h owner | — | — | ⏳ | — | 🤔 |

🧑 **→** Next: [🤔](work/records/F-014.md) F-014-T01 — Owner decides whether to add Google place data (Ready).

| | |
|---|---|
| **Issue** | Google Maps could enrich places (opening hours, photos, ratings) later. Optional: it brings a paid key and terms of use. |
| **Reproduce** | — |
| **Check** | The owner decides; if yes, a Google place-details provider sits behind the adapter and only enriches places. |

**Feature steps**

| Effort | Step | Estimate | Actual | Remaining | Status | Depends on | Unlocks | Who |
|---|---|---|---|---|---|---|---|:---:|
| 🟢 Small | <a id="f-014-t01"></a>F-014-T01 — Owner decides whether to add Google place data | 0 h | 0 h | 0 h agent + 0.25 h owner | Ready | — | [F-014-T02](#f-014-t02) | [🤔](work/records/F-014.md) |
| 🟡 Medium | <a id="f-014-t02"></a>F-014-T02 — Google place-details provider | 2 h | 0 h | 2 h | Planned | [F-014-T01](#f-014-t01) | — | ⏳ 🤖 |
| 🟡 Medium | **Total** | 2 h | 0 h (0 of 2 steps recorded) | 2 h agent + 0.25 h owner | 0 of 2 completed | | | |

<details>
<summary>Next action, estimates and PR history</summary>

[Full notes & evidence](work/records/F-014.md)

| Field | Value |
|---|---|
| PR / evidence | [#1](https://github.com/voidbrain/hobo/pull/1) |
| Opened | 2026-11-25 |
| Verification | Pending |
| Reviewed | 2026-11-25 |

</details>

---
## Other changes

**Plan revision, 2026-11-25 (fresh review relayed by the coordinator).** Storage is a small Node 24 `server/` with SQLite that the app talks to (IndexedDB only as an optional offline cache later); the OpenRouteService key lives in git-ignored `server/` config, never in `public/`; F-007-T01 now waits on F-002-T01; F-011-T01 also waits on F-003-T01 and F-004-T02; F-008-T04 on F-003-T01 and F-004-T03. Estimates unchanged.

## How to use this file

| Status | Requirements | Next statuses and conditions | Priority cue |
|---|---|---|---|
| **🔴 Open** | Reproducible bug or agreed capability; scope and next action recorded. | - **Investigate** if cause/scope is uncertain<br>- **Implemented** when code is complete<br>- **Blocked** if a named dependency prevents progress<br>- **Closed** if cancelled/superseded, with reason. | Coloured |
| **🟠 Investigate** | Report and unanswered question recorded; next diagnostic identified. | - **Open** when scope/cause is established<br>- **Implemented** when fixed<br>- **Blocked** if evidence/dependency is unavailable<br>- **Closed** if duplicate/not reproducible after documented investigation, with reason. | Coloured |
| **🟡 Implemented** | Code exists; required verification remains pending. | - **Verified** when all acceptance checks pass (automated ones: the merged PR's green CI run)<br>- Open or Investigate if a check fails<br>- **Blocked** if a required check cannot proceed. | Coloured |
| **🟢 Verified** | All acceptance checks passed; date, method and evidence recorded, including human/device checks when required. | - **Closed** when no action remains and resolution is recorded<br>- **Open** or **Investigate** if new evidence invalidates verification. Do not leave completed items here indefinitely. | Coloured |
| **🟣 Blocked** | Specific blocker, affected work/check and resume condition recorded. | - Return to **Open**, **Investigate** or **Implemented** when unblocked<br>- **Verified** only after all checks pass<br>- **Closed** if cancelled/superseded, with reason. | Grey ◻️ |
| **🔵 Closed** | Resolution recorded and item archived. | - **Open** or **Investigate** if reopened by new evidence<br>Retain ID, original Opened date and historical closure record. | Grey ◻️ |

Follow [Backlog rules](BACKLOG-RULES.md) for updating records, reconciling PR/CI evidence, stale-state review, closure/archiving, human dependencies and table validation. Preserve stable IDs and existing user edits.

Each item shows its ID and title, a summary table (status with its colour, priority, effort size; with source-owned records also remaining time, Depends on, Unlocks and Procedures and Decisions, 🧑 where the record or one of its ready steps waits on that kind of human action), the human or next action, and Issue / Reproduce / Check. Expand the closed details for next actions, estimate rationale, PR history, dates and verification. Effort, from the remaining agent hours (owner time apart): 🟢 Small ≤1 h · 🟡 Medium ≤4 h · 🔴 Large ≤8 h · 🟣 Very large more; work still estimated in days: 🟢 Small ≤1 day · 🟡 Medium 2–3 days · 🔴 Large ≥4 days. Status and verification evidence describe progress; effort is an estimate of work still required. A `---` line ends every item.
