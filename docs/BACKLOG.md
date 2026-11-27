# <a id="top"></a>Hobo backlog

Current work ledger, reviewed 27 November 2026 against main `d52f88e`. Generated from [record sources](work/records) and [steps](work/tasks) by `npm run work:build`: edit those, not this file. [Rules](BACKLOG-RULES.md) · [Archive](archive/README.md) · [Reading the records](#how-to-use-this-file).

<!-- totals:start -->
**Remaining effort:** 48 h agent + 2.5 h owner across 37 open steps of 16 features. Generated from the task files.
<!-- totals:end -->

## Work items

Bugs (B-) and features (F-) in one list, in work-queue order. Steps: `effort` = remaining agent time (🟢 up to 1 h · 🟡 4 h · 🔴 8 h · 🟣 more); `h` = agent hours, owner time apart; a step status is not the record's acceptance.

### <a id="f-002"></a>[✨ F-002](#top)

**Places: collect and organise**

| Status | Priority | Effort | Remaining | Depends on | Unlocks | Agent | Procedures | Decisions |
|---|---|---|---|---|---|:---:|:---:|:---:|
| 🔴 Open | 🔶 P2 | 🟢 Small | 0.5 h | — | [F-003-T02](#f-003-t02) | 🤖 | 🧑‍🔧 | — |

🧑 **→** Confirm place-location search and selection in the [manual walkthrough](manual-checks/places-and-trips.md#f-002-t04--place-location).

| | |
|---|---|
| **Issue** | Places are added at random as they are found, then organised. Each place has a name, description, images, category, tags, notes, a location and the time spent on site (2 h, half day or full day, queues and movement on site included). Deletion must not lose trip references. Data stays on the owner's own machine or base: a small Node 24 `server/` with SQLite (`node:sqlite`) that the Angular app talks to; it also serves the NERV MCP server (F-011), share links (F-008) and keeps API keys off the client. IndexedDB is at most an optional offline cache later. No hosted multi-user backend. |
| **Reproduce** | Before F-002-T06, deleting a place through the API also removed its matching trip stops, and the places page had no delete control. |
| **Check** | A place can be added with only a name, then edited to fill every field; an empty name shows an announced danger error and marks the field invalid; a missing OpenRouteService key is explained; the map-centre control requires zoom level 10; images are stored locally with GPS metadata stripped; places can be filtered and grouped by category and tag; deletion requires keyboard-operable confirmation and announces its result; a referenced place is refused with all trip names and its references stay intact; data survives a restart and never enters git. |

**Feature steps**

| Effort | Step | Estimate | Actual | Remaining | Status | Depends on | Unlocks | PRs |
|---|---|---|---|---|---|---|---|---|
| 🟢 Small | <a id="f-002-t04"></a>F-002-T04 — Place location | 2 h | 0 h | 0.25 h | Implemented; verification pending | — | — | — |
| 🟢 Small | <a id="f-002-t06"></a>F-002-T06 — Delete a place | 1 h | 0 h | 0.25 h | Implemented; verification pending | — | [F-003-T02](#f-003-t02) | — |
| 🟢 Small | **Total** | 12.5 h | 0 h (0 of 6 steps recorded) | 0.5 h | 4 of 6 completed | | | |

<details><summary>Done steps (4)</summary>

| Effort | Step | Estimate | Actual | Status | PRs |
|---|---|---|---|---|---|
| — | <a id="f-002-t01"></a>F-002-T01 — Local store service and place model | 3 h | 0 h | Completed | [PR #5](https://github.com/voidbrain/hobo/pull/5) local store service and place model |
| — | <a id="f-002-t02"></a>F-002-T02 — Place list and form | 2.5 h | 0 h | Completed | [PR #23](https://github.com/voidbrain/hobo/pull/23) place list and form; [PR #26](https://github.com/voidbrain/hobo/pull/26) required-name error accessibility |
| — | <a id="f-002-t03"></a>F-002-T03 — Place images | 2 h | 0 h | Completed | [PR #7](https://github.com/voidbrain/hobo/pull/7) content-sniffed place image upload, size limit, EXIF/GPS stripping and thumbnail component |
| 🟢 Small | <a id="f-002-t05"></a>F-002-T05 — Categories and tags | 2 h | 0 h | Verified | — |

</details>

<details>
<summary>Next action, estimates and PR history</summary>

[Full notes & evidence](work/records/F-002.md)

| Field | Value |
|---|---|
| PR / evidence | Steps: F-002-T01: [PR #5](https://github.com/voidbrain/hobo/pull/5) local store service and place model; step review: 2026-11-25 design-reviewer (fresh context, Opus): no blockers; fixed a 500 on a malformed id escape (test first) and added a rollback to a failed migration. Project-only harness edits: package.json (type module, server scripts; npm test also runs the server tests) and a marked CI step. · F-002-T02: [PR #23](https://github.com/voidbrain/hobo/pull/23) place list and form; [PR #26](https://github.com/voidbrain/hobo/pull/26) required-name error accessibility · F-002-T03: [PR #7](https://github.com/voidbrain/hobo/pull/7) content-sniffed place image upload, size limit, EXIF/GPS stripping and thumbnail component; step review: 2026-11-26 Claude (Opus, fresh worktree) reviewed PR #7 written by Gemini. Fixed (test first): an upload announcing a Content-Length over 5 MB is now refused with 413 before its body is read. Added tests: a real decodable JPEG with a well-formed GPS EXIF IFD (stripped, scan data kept; also checked with macOS ImageIO: GPS present before, absent after, image still decodes), deleting a place unlinks its files, and image names that would leave the folder answer 404.. [Earlier T01/T03 and review evidence](archive/evidence-2026.md#f-002); [#23](https://github.com/voidbrain/hobo/pull/23) (T02); [#24](https://github.com/voidbrain/hobo/pull/24) (T04); Review: fresh-context design review 2026-11-27, findings fixed in #24; [#26](https://github.com/voidbrain/hobo/pull/26) (T02 error fix, independent review); [#27](https://github.com/voidbrain/hobo/pull/27) (T04 setup guidance and map-centre zoom guard, CI 45980660890); Test: T05 `src/app/core/place-taxonomy.spec.ts`, `src/app/data/places-api.spec.ts`, `src/app/pages/places/places-page.spec.ts`, `server/api.test.ts` (failing first); [#28](https://github.com/voidbrain/hobo/pull/28), CI 45992151509 green; T06 `server/trips.test.ts`, `src/app/pages/places/places-page.spec.ts` (failing first) |
| Opened | 2026-11-25 |
| Verification | Unit/integration · 2026-11-27 · T05 taxonomy tests 23/23 focused; full suite before T06 had 76 Angular and 48 server tests passed; #28 CI 45992151509 green. T06 local suite 80 Angular and 48 server tests passed; build, fast checks, integrations and conventions pass; PR CI pending. Human · 2026-11-27 · F-002-T02 passed owner walkthrough; F-002-T04 location walkthrough pending |
| Reviewed | 2026-11-27 |

</details>

---
### <a id="f-003"></a>[✨ F-003](#top)

**Trips: dates, start and end, stops**

| Status | Priority | Effort | Remaining | Depends on | Unlocks | Agent | Procedures | Decisions |
|---|---|---|---|---|---|:---:|:---:|:---:|
| 🔴 Open | 🔶 P2 | 🔴 Large | 5 h | [F-002-T06](#f-002-t06) | [F-004-T02](#f-004-t02) | ⏳ | — | — |

💻 **→** Next: F-003-T02 — Trip editor (Planned).

| | |
|---|---|
| **Issue** | A trip has dates (a single day or several), a start and an end (home by default) and stops, picked from places or added on the fly. |
| **Reproduce** | There is no trip yet. |
| **Check** | A trip can be created for one or more days; from and to default to the home set in settings and can be changed; stops are picked from places or created on the fly (which adds a place); stops can be reordered and moved between days. |

**Feature steps**

| Effort | Step | Estimate | Actual | Remaining | Status | Depends on | Unlocks | PRs |
|---|---|---|---|---|---|---|---|---|
| 🟡 Medium | <a id="f-003-t02"></a>F-003-T02 — Trip editor | 3 h | 0 h | 3 h | Planned | [F-002-T06](#f-002-t06) | [F-003-T03](#f-003-t03), [F-004-T02](#f-004-t02) | — |
| 🟡 Medium | <a id="f-003-t03"></a>F-003-T03 — Reorder stops and move them between days | 2 h | 0 h | 2 h | Planned | [F-003-T02](#f-003-t02) | — | — |
| 🔴 Large | **Total** | 7 h | 0 h (0 of 3 steps recorded) | 5 h | 1 of 3 completed | | | |

<details><summary>Done steps (1)</summary>

| Effort | Step | Estimate | Actual | Status | PRs |
|---|---|---|---|---|---|
| — | <a id="f-003-t01"></a>F-003-T01 — Trip model and API | 2 h | 0 h | Completed | [PR #6](https://github.com/voidbrain/hobo/pull/6) trip model, pure helpers, SQLite persistence, home settings and trips API |

</details>

<details>
<summary>Next action, estimates and PR history</summary>

[Full notes & evidence](work/records/F-003.md)

| Field | Value |
|---|---|
| PR / evidence | Steps: F-003-T01: [PR #6](https://github.com/voidbrain/hobo/pull/6) trip model, pure helpers, SQLite persistence, home settings and trips API; step review: 2026-11-26 Claude (Opus, fresh worktree) reviewed PR #6 written by Gemini: no blockers. Added API tests for 400/404/405 answers, unknown home and endpoint places, a single day with no home, time-zone independence across a daylight-saving change, and clearing a deleted place from home and trip endpoints; documented that dates carry no time zone and that shrinking a trip drops stops outside the new range.. [#1](https://github.com/voidbrain/hobo/pull/1); [#6](https://github.com/voidbrain/hobo/pull/6) (F-003-T01, CI 45720389688); Test: `src/app/core/trip.spec.ts`, `src/app/data/trips-api.spec.ts`, `server/trips.test.ts` (`193bbca`); Review: 2026-11-26 Claude (Opus), no blockers; added API error, time-zone and deleted-place tests |
| Opened | 2026-11-25 |
| Verification | Unit/integration · 2026-11-27 · F-003-T01 (#6 CI 45720389688) green; UI steps pending |
| Reviewed | 2026-11-27 |

</details>

---
### <a id="f-004"></a>[✨ F-004](#top)

**Routing totals per leg, per day and per trip**

| Status | Priority | Effort | Remaining | Depends on | Unlocks | Agent | Procedures | Decisions |
|---|---|---|---|---|---|:---:|:---:|:---:|
| 🔴 Open | 🔶 P2 | 🟡 Medium | 4 h | [F-003-T02](#f-003-t02) | [F-005-T01](#f-005-t01), [F-006-T02](#f-006-t02), [F-008-T01](#f-008-t01), [F-008-T02](#f-008-t02), [F-008-T04](#f-008-t04), [F-011-T01](#f-011-t01) | ⏳ | — | — |

💻 **→** Next: F-004-T02 — Legs through the adapter (Planned).

| | |
|---|---|
| **Issue** | For a trip, Hobo shows km and time per leg and in total, filtered by one day, several days or the whole trip. Time is A→B travel + time at B + B→C travel and so on; home and the end point have no stay. |
| **Reproduce** | A trip with stops shows no distance or time. |
| **Check** | Each leg shows km and travel time; each day and the selected days show km, travel time, time on site and total; the whole trip shows the same; numbers match a hand calculation on an invented trip. |

**Feature steps**

| Effort | Step | Estimate | Actual | Remaining | Status | Depends on | Unlocks | PRs |
|---|---|---|---|---|---|---|---|---|
| 🟡 Medium | <a id="f-004-t02"></a>F-004-T02 — Legs through the adapter | 2 h | 0 h | 2 h | Planned | [F-003-T02](#f-003-t02) | [F-004-T03](#f-004-t03), [F-005-T01](#f-005-t01), [F-008-T01](#f-008-t01), [F-011-T01](#f-011-t01) | — |
| 🟡 Medium | <a id="f-004-t03"></a>F-004-T03 — Day filter, summary and route on the map | 2 h | 0 h | 2 h | Planned | [F-004-T02](#f-004-t02) | [F-006-T02](#f-006-t02), [F-008-T02](#f-008-t02), [F-008-T04](#f-008-t04) | — |
| 🟡 Medium | **Total** | 5.5 h | 0 h (0 of 3 steps recorded) | 4 h | 1 of 3 completed | | | |

<details><summary>Done steps (1)</summary>

| Effort | Step | Estimate | Actual | Status | PRs |
|---|---|---|---|---|---|
| — | <a id="f-004-t01"></a>F-004-T01 — Pure totals | 1.5 h | 0 h | Completed | [PR #4](https://github.com/voidbrain/hobo/pull/4) pure route totals in src/app/core/route-totals.ts |

</details>

<details>
<summary>Next action, estimates and PR history</summary>

[Full notes & evidence](work/records/F-004.md)

| Field | Value |
|---|---|
| PR / evidence | Steps: F-004-T01: [PR #4](https://github.com/voidbrain/hobo/pull/4) pure route totals in src/app/core/route-totals.ts. [#1](https://github.com/voidbrain/hobo/pull/1); [#4](https://github.com/voidbrain/hobo/pull/4) (F-004-T01, CI 45717300407) |
| Opened | 2026-11-25 |
| Verification | Unit/integration · 2026-11-27 · F-004-T01 (#4 CI 45717300407) green; adapter/UI steps pending |
| Reviewed | 2026-11-27 |

</details>

---
### <a id="f-007"></a>[✨ F-007](#top)

**Map provider adapter: Leaflet and OpenRouteService**

| Status | Priority | Effort | Remaining | Depends on | Unlocks | Agent | Procedures | Decisions |
|---|---|---|---|---|---|:---:|:---:|:---:|
| 🔴 Open | 🔶 P2 | 🟢 Small | 0.5 h agent + 0.25 h owner | — | — | 🤖 | 🧑‍🔧 | — |

💻 **→** Next: F-007-T05 — One &#91;lng, lat&#93; pair parser and one point type for both routing providers (Planned).

| | |
|---|---|
| **Issue** | Maps, routing, the distance/time matrix and geocoding go through one adapter, so providers can change. Start with Leaflet (OpenStreetMap tiles) and OpenRouteService (routing, matrix, geocoding and autocomplete, free key). Leg results are cached so what-if comparisons do not re-query. Routing and geocoding calls go through `server/`, which holds the key in git-ignored `server/config.local.json`; the key never reaches `public/` or the browser. |
| **Reproduce** | Copy `server/config.example.json` to `server/config.local.json`, set `openRouteServiceApiKey`, run `npm run server`, and call `POST http://127.0.0.1:4310/api/maps/route` with two invented `{ lat, lng }` points. |
| **Check** | One `MapProvider` interface; an OpenRouteService implementation tested against recorded fixtures; a Leaflet map component with attribution; a leg cache keyed by provider, profile, from and to; the key read only by `server/` from git-ignored `server/config.local.json`; a live route works with the owner's key. |

**Feature steps**

| Effort | Step | Estimate | Actual | Remaining | Status | Who | PRs |
|---|---|---|---|---|---|:---:|---|
| 🟢 Small | <a id="f-007-t04"></a>F-007-T04 — Owner adds an OpenRouteService key and checks a live route | 0 h | 0 h | 0 h agent + 0.25 h owner | Planned | [🧑‍🔧](work/records/F-007.md) | — |
| 🟢 Small | <a id="f-007-t05"></a>F-007-T05 — One &#91;lng, lat&#93; pair parser and one point type for both routing providers | 0.5 h | 0 h | 0.5 h | Planned | 🤖 | [PR #17](https://github.com/voidbrain/hobo/pull/17) plan |
| 🟢 Small | **Total** | 7.5 h | 0 h (0 of 5 steps recorded) | 0.5 h agent + 0.25 h owner | 3 of 5 completed | | |

<details><summary>Done steps (3)</summary>

| Effort | Step | Estimate | Actual | Status | PRs |
|---|---|---|---|---|---|
| — | <a id="f-007-t01"></a>F-007-T01 — Adapter interface, local config and leg cache | 2 h | 0 h | Completed | [PR #8](https://github.com/voidbrain/hobo/pull/8) MapProvider adapter interface, local config without committed keys, and SQLite leg cache |
| — | <a id="f-007-t02"></a>F-007-T02 — Leaflet map component | 2 h | 0 h | Completed | [PR #12](https://github.com/voidbrain/hobo/pull/12) MapView: Leaflet, OSM tiles and attribution, markers and route lines from inputs, token classes |
| — | <a id="f-007-t03"></a>F-007-T03 — OpenRouteService provider | 3 h | 0 h | Completed | [PR #9](https://github.com/voidbrain/hobo/pull/9) OpenRouteService directions, matrix, geocode and autocomplete via server /api/maps, MapsApi client and recorded fixtures |

</details>

<details>
<summary>Next action, estimates and PR history</summary>

[Full notes & evidence](work/records/F-007.md)

| Field | Value |
|---|---|
| PR / evidence | Steps: F-007-T01: [PR #8](https://github.com/voidbrain/hobo/pull/8) MapProvider adapter interface, local config without committed keys, and SQLite leg cache · F-007-T02: [PR #12](https://github.com/voidbrain/hobo/pull/12) MapView: Leaflet, OSM tiles and attribution, markers and route lines from inputs, token classes · F-007-T03: [PR #9](https://github.com/voidbrain/hobo/pull/9) OpenRouteService directions, matrix, geocode and autocomplete via server /api/maps, MapsApi client and recorded fixtures · F-007-T05: [PR #17](https://github.com/voidbrain/hobo/pull/17) plan. [#1](https://github.com/voidbrain/hobo/pull/1); [#2](https://github.com/voidbrain/hobo/pull/2) (review fixes); [#8](https://github.com/voidbrain/hobo/pull/8) (F-007-T01); [#9](https://github.com/voidbrain/hobo/pull/9) (F-007-T03); [#12](https://github.com/voidbrain/hobo/pull/12) (F-007-T02, CI 45784696923); [#17](https://github.com/voidbrain/hobo/pull/17) (plan); [#21](https://github.com/voidbrain/hobo/pull/21) (coordinator prefix); Test: `src/app/maps/map-provider.spec.ts`, `server/config.test.ts`, `server/leg-cache.test.ts` (`47d4b46`), `server/ors.test.ts`, `src/app/maps/maps-api.spec.ts` (`bde43bb`), `src/app/maps/map-view.spec.ts` |
| Opened | 2026-11-25 |
| Verification | Unit/integration · 2026-11-27 · F-007-T01 (#8), F-007-T02 (#12 CI 45784696923) and F-007-T03 (#9) green; F-007-T04 owner live key check and F-007-T05 pending |
| Reviewed | 2026-11-27 |

</details>

---
### <a id="f-011"></a>[✨ F-011](#top)

**NERV integration: MCP server for places, trips and totals**

| Status | Priority | Effort | Remaining | Depends on | Unlocks | Agent | Procedures | Decisions |
|---|---|---|---|---|---|:---:|:---:|:---:|
| 🔴 Open | 🔹 P3 | 🔴 Large | 4.25 h agent + 0.25 h owner | [F-004-T02](#f-004-t02) | [F-018-T01](#f-018-t01), [F-018-T05](#f-018-t05) | ⏳ | — | — |

💻 **→** Next: F-011-T01 — MCP endpoint in the local service (Planned).

| | |
|---|---|
| **Issue** | NERV should read Hobo the way it reads Grover's hub: an MCP server exposing places, trips and route totals. |
| **Reproduce** | NERV cannot see Hobo. |
| **Check** | The local service exposes an MCP endpoint with read tools (list places, get a trip, route totals for a trip, a day or the whole trip); an end-to-end test lists and calls the tools; NERV answers a question about a trip from chat. |

**Feature steps**

| Effort | Step | Estimate | Actual | Remaining | Status | Depends on | Unlocks | Who | PRs |
|---|---|---|---|---|---|---|---|:---:|---|
| 🟡 Medium | <a id="f-011-t01"></a>F-011-T01 — MCP endpoint in the local service | 2.5 h | 0 h | 2.5 h | Planned | [F-004-T02](#f-004-t02) | [F-011-T02](#f-011-t02), [F-011-T03](#f-011-t03), [F-018-T01](#f-018-t01) | ⏳ 🤖 | — |
| 🟢 Small | <a id="f-011-t02"></a>F-011-T02 — Owner connects Hobo to NERV and checks it from chat | 0 h | 0 h | 0 h agent + 0.25 h owner | Planned | [F-011-T01](#f-011-t01) | — | ⏳ 🧑‍🔧 | — |
| 🟡 Medium | <a id="f-011-t03"></a>F-011-T03 — Gauntlet cases for the MCP tools (hobo-v1), Italian and English | 1.75 h | 0 h | 1.75 h | Planned | [F-011-T01](#f-011-t01) | [F-018-T05](#f-018-t05) | ⏳ 🤖 | [PR #17](https://github.com/voidbrain/hobo/pull/17) plan |
| 🔴 Large | **Total** | 4.25 h | 0 h (0 of 3 steps recorded) | 4.25 h agent + 0.25 h owner | 0 of 3 completed | | | | |

<details>
<summary>Next action, estimates and PR history</summary>

[Full notes & evidence](work/records/F-011.md)

| Field | Value |
|---|---|
| PR / evidence | Steps: F-011-T03: [PR #17](https://github.com/voidbrain/hobo/pull/17) plan. [#1](https://github.com/voidbrain/hobo/pull/1); [#2](https://github.com/voidbrain/hobo/pull/2) (review fixes); [#17](https://github.com/voidbrain/hobo/pull/17) (plan); [#19](https://github.com/voidbrain/hobo/pull/19) (write-tools link); [#21](https://github.com/voidbrain/hobo/pull/21) (coordinator prefix) |
| Opened | 2026-11-25 |
| Verification | Pending |
| Reviewed | 2026-11-27 |

</details>

---
### <a id="f-008"></a>[✨ F-008](#top)

**Share and export**

| Status | Priority | Effort | Remaining | Depends on | Unlocks | Agent | Procedures | Decisions |
|---|---|---|---|---|---|:---:|:---:|:---:|
| 🔴 Open | 🔹 P3 | 🔴 Large | 6.5 h agent + 0.5 h owner | [F-004-T02](#f-004-t02), [F-004-T03](#f-004-t03) | [F-009-T01](#f-009-t01) | ⏳ | — | 🤔 |

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
| 🟡 Medium | <a id="f-008-t04"></a>F-008-T04 — Read-only share link | 2.5 h | 0 h | 2.5 h | Planned | [F-008-T03](#f-008-t03), [F-004-T03](#f-004-t03) | [F-009-T01](#f-009-t01) | ⏳ 🤖 |
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
### <a id="f-016"></a>[✨ F-016](#top)

**Turn on the dormant procedure settings and prove the maintenance workflow runs**

| Status | Priority | Effort | Remaining | Depends on | Unlocks | Agent | Procedures | Decisions |
|---|---|---|---|---|---|:---:|:---:|:---:|
| 🔴 Open | 🔹 P3 | 🟢 Small | 0.25 h | — | — | 🤖 | — | — |

💻 **→** Next: F-016-T04 — Confirm the scheduled maintenance run (Planned).

| | |
|---|---|
| **Issue** | The 2026-11-26 dormant-checks sweep (coordinator `docs/audits/2026-11-26-dormant-checks.md`, rows S1, S2, S3, S5, W1) found no periodic reviews (`reviews` unset), coverage regressions that only warn (`coverage.enforce` unset), work-usage measurement off, no `behaviour.runner`, and a daily maintenance workflow that had never run (the repository was created on 2026-11-25). |
| **Reproduce** | `.harness.json` on `main` `fc67aa3`: no `reviews`, no `coverage.enforce`, `workUsage.enabled: false`, `behaviour` `{times: 3}`; `gh run list --workflow maintenance.yml`: no runs. |
| **Check** | `.harness.json` sets `reviews` (token, architecture, skills at 30 days), `coverage.enforce: true` (switched on by F-016-T05 once a current baseline is on `main`: under enforce the check reads the baseline from `origin/main`, so the PR that refreshes it cannot enforce it), `workUsage.enabled: true` and `behaviour.runner`; the first architecture review with its outside-landscape comparison is `docs/reviews/architecture/2026-11-26.md`; CI passes with enforcement on (or a real drop is fixed or recorded); a manual maintenance run passed (run 45798434567, 2026-11-26), and F-016-T04 verifies a scheduled run on or after 2026-11-27. First token and skills reviews are in `docs/reviews/token/2026-11-27.md` and `docs/reviews/skills/2026-11-27.md` (F-016-T03). |

**Feature steps**

| Effort | Step | Estimate | Actual | Remaining | Status | PRs |
|---|---|---|---|---|---|---|
| 🟢 Small | <a id="f-016-t04"></a>F-016-T04 — Confirm the scheduled maintenance run | 0.25 h | 0 h | 0.25 h | Planned | — |
| 🟢 Small | **Total** | 2.25 h | 0 h (0 of 5 steps recorded) | 0.25 h | 4 of 5 completed | |

<details><summary>Done steps (4)</summary>

| Effort | Step | Estimate | Actual | Status | PRs |
|---|---|---|---|---|---|
| — | <a id="f-016-t01"></a>F-016-T01 — Reviews, coverage enforcement, work usage and behaviour runner settings | 0.25 h | 0 h | Completed | [PR #14](https://github.com/voidbrain/hobo/pull/14) settings on |
| — | <a id="f-016-t02"></a>F-016-T02 — First architecture review with outside-landscape comparison | 0.5 h | 0 h | Completed | [PR #14](https://github.com/voidbrain/hobo/pull/14) first architecture review |
| — | <a id="f-016-t03"></a>F-016-T03 — First token and skills reviews | 1 h | 0 h | Completed | — |
| — | <a id="f-016-t05"></a>F-016-T05 — Turn coverage.enforce on | 0.25 h | 0 h | Completed | [PR #15](https://github.com/voidbrain/hobo/pull/15) coverage.enforce on |

</details>

<details>
<summary>Next action, estimates and PR history</summary>

[Full notes & evidence](work/records/F-016.md)

| Field | Value |
|---|---|
| PR / evidence | Steps: F-016-T01: [PR #14](https://github.com/voidbrain/hobo/pull/14) settings on · F-016-T02: [PR #14](https://github.com/voidbrain/hobo/pull/14) first architecture review · F-016-T05: [PR #15](https://github.com/voidbrain/hobo/pull/15) coverage.enforce on. [#14](https://github.com/voidbrain/hobo/pull/14) (F-016-T01, F-016-T02, CI 45801540013); [#15](https://github.com/voidbrain/hobo/pull/15) (F-016-T05, CI 45802414492); [#23](https://github.com/voidbrain/hobo/pull/23) (F-016-T03, CI 45964356626); [#25](https://github.com/voidbrain/hobo/pull/25) |
| Opened | 2026-11-26 |
| Verification | Unit/integration · 2026-11-27 · F-016-T01 and F-016-T02 (#14 CI 45801540013), F-016-T05 (#15 CI 45802414492) and F-016-T03 (#23 CI 45964356626) green; F-016-T04 pending: no qualifying scheduled run yet |
| Reviewed | 2026-11-27 |

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
| 🔴 Open | 🔹 P3 | 🟡 Medium | 3.5 h | [F-004-T03](#f-004-t03) | — | 🤖 | — | — |

💻 **→** Next: F-006-T01 — Variant model (Planned).

| | |
|---|---|
| **Issue** | A trip can hold several variants, shown as tabs, to compare alternative plans. |
| **Reproduce** | A trip has one plan only. |
| **Check** | A variant can be created by duplicating the current one, renamed and deleted; tabs switch between them; totals of the variants can be compared side by side. |

**Feature steps**

| Effort | Step | Estimate | Actual | Remaining | Status | Depends on | Unlocks |
|---|---|---|---|---|---|---|---|
| 🟡 Medium | <a id="f-006-t01"></a>F-006-T01 — Variant model | 1.5 h | 0 h | 1.5 h | Planned | — | [F-006-T02](#f-006-t02) |
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
| 🔴 Open | 🔹 P3 | 🟡 Medium | 3.5 h | `bricks:F-007-T03` | — | 🤖 | — | — |

💻 **→** Next: F-010-T01 — Bricks-ready contract and check (Ready).

| | |
|---|---|
| **Issue** | Shared components should come from 🧱 bricks (coordinator coordinator:F-012), the planned shared UI library voidbrain/bricks. Until it exists, Hobo builds its shared components so they can move there unchanged. |
| **Reproduce** | — |
| **Check** | Shared components live in `src/app/shared/`, take inputs and outputs only, use tokens only and inject no app service, and a lint rule enforces it; once bricks exists, they move there and Hobo imports them. |

**Feature steps**

| Effort | Step | Estimate | Actual | Remaining | Status | Depends on | Unlocks |
|---|---|---|---|---|---|---|---|
| 🟡 Medium | <a id="f-010-t01"></a>F-010-T01 — Bricks-ready contract and check | 1.5 h | 0 h | 1.5 h | Ready | — | [F-010-T02](#f-010-t02) |
| 🟡 Medium | <a id="f-010-t02"></a>F-010-T02 — Move shared components to bricks | 2 h | 0 h | 2 h | Planned | [F-010-T01](#f-010-t01), `bricks:F-007-T03` | — |
| 🟡 Medium | **Total** | 3.5 h | 0 h (0 of 2 steps recorded) | 3.5 h | 0 of 2 completed | | |

<details>
<summary>Next action, estimates and PR history</summary>

[Full notes & evidence](work/records/F-010.md)

| Field | Value |
|---|---|
| PR / evidence | [#1](https://github.com/voidbrain/hobo/pull/1); [#2](https://github.com/voidbrain/hobo/pull/2) (review fixes); [#13](https://github.com/voidbrain/hobo/pull/13) (dependency update); [#21](https://github.com/voidbrain/hobo/pull/21) (coordinator prefix) |
| Opened | 2026-11-25 |
| Verification | Pending |
| Reviewed | 2026-11-27 |

</details>

---
### <a id="f-013"></a>[✨ F-013](#top)

**Self-hosted routing and geocoding (later)**

| Status | Priority | Effort | Remaining | Depends on | Unlocks | Agent | Procedures | Decisions |
|---|---|---|---|---|---|:---:|:---:|:---:|
| 🔴 Open | 🔹 P3 | 🟡 Medium | 2 h agent + 1 h owner | — | — | 🤖 | — | — |

💻 **→** Next: F-013-T02 — Nominatim or Photon geocoding provider (Planned).

| | |
|---|---|
| **Issue** | Later, routing and the matrix come from a self-hosted OSRM, and geocoding from Nominatim or Photon, on the owner's base, to drop the API key and quota. |
| **Reproduce** | — |
| **Check** | OSRM and Nominatim or Photon providers implement the adapter, pass the same fixture tests as OpenRouteService, and the owner's base serves them. When F-013-T02 adds the Nominatim or Photon geocoder, compare it with openbando's `src/app/services/geo.service.ts` geocode and `coarserQueries` (`core/geo.ts:170`): if both would import the same client, propose a first `geo` package in blocks (the Nominatim client with its rate policy, query coarsening, `parseLatLon` and one point type with `lng`/`lon` settled) through a coordination record; otherwise record the reason (trigger from the F-012 verdict, owner "ok to all" 2026-11-26). |

**Feature steps**

| Effort | Step | Estimate | Actual | Remaining | Status | Depends on | Unlocks | Who | PRs |
|---|---|---|---|---|---|---|---|:---:|---|
| 🟡 Medium | <a id="f-013-t02"></a>F-013-T02 — Nominatim or Photon geocoding provider | 2 h | 0 h | 2 h | Planned | — | [F-013-T03](#f-013-t03) | 🤖 | — |
| 🟢 Small | <a id="f-013-t03"></a>F-013-T03 — Owner runs OSRM and Photon on the base | 0 h | 0 h | 0 h agent + 1 h owner | Planned | [F-013-T02](#f-013-t02) | — | ⏳ 🧑‍🔧 | — |
| 🟡 Medium | **Total** | 4 h | 0 h (0 of 3 steps recorded) | 2 h agent + 1 h owner | 1 of 3 completed | | | | |

<details><summary>Done steps (1)</summary>

| Effort | Step | Estimate | Actual | Status | PRs |
|---|---|---|---|---|---|
| — | <a id="f-013-t01"></a>F-013-T01 — OSRM provider | 2 h | 0 h | Completed | [PR #11](https://github.com/voidbrain/hobo/pull/11) OSRM route and matrix behind the MapProvider adapter, config-only base URL, recorded-fixture contract shared with ORS |

</details>

<details>
<summary>Next action, estimates and PR history</summary>

[Full notes & evidence](work/records/F-013.md)

| Field | Value |
|---|---|
| PR / evidence | Steps: F-013-T01: [PR #11](https://github.com/voidbrain/hobo/pull/11) OSRM route and matrix behind the MapProvider adapter, config-only base URL, recorded-fixture contract shared with ORS. [#1](https://github.com/voidbrain/hobo/pull/1); [#11](https://github.com/voidbrain/hobo/pull/11) (F-013-T01); Test: `server/osrm.test.ts`, `server/config.test.ts`; [#17](https://github.com/voidbrain/hobo/pull/17) (plan) |
| Opened | 2026-11-25 |
| Verification | Pending |
| Reviewed | 2026-11-26 |

</details>

---
### <a id="f-015"></a>[✨ F-015](#top)

**Full audit and audit enforcement**

| Status | Priority | Effort | Remaining | Depends on | Unlocks | Agent | Procedures | Decisions |
|---|---|---|---|---|---|:---:|:---:|:---:|
| 🔴 Open | 🔹 P3 | 🟡 Medium | 3.5 h | — | — | 🤖 | — | — |

💻 **→** Next: F-015-T01 — Next audit as kind full (Planned).

| | |
|---|---|
| **Issue** | Hobo has only a scoped audit (2026-11-25, which checked all eight areas), so no report of kind `full` exists and `audit.enforce` is off. The 2026-11-26 cross-project audit (coordinator, docs/audits/2026-11-26-cross-project.md, proposal 16) proposes a full audit, then enforcement. |
| **Reproduce** | `docs/audits/2026-11-25-baseline.audit.json` has `"kind": "scoped"`; `.harness.json` has `"audit": {"enforce": false}`. |
| **Check** | A report with manifest `kind: full` passes `npm run check:audits`, and `audit.enforce` is true. |

**Feature steps**

| Effort | Step | Estimate | Actual | Remaining | Status | Depends on | Unlocks |
|---|---|---|---|---|---|---|---|
| 🟡 Medium | <a id="f-015-t01"></a>F-015-T01 — Next audit as kind full | 3 h | 0 h | 3 h | Planned | — | [F-015-T02](#f-015-t02) |
| 🟢 Small | <a id="f-015-t02"></a>F-015-T02 — Turn audit.enforce on | 0.5 h | 0 h | 0.5 h | Planned | [F-015-T01](#f-015-t01) | — |
| 🟡 Medium | **Total** | 3.5 h | 0 h (0 of 2 steps recorded) | 3.5 h | 0 of 2 completed | | |

<details>
<summary>Next action, estimates and PR history</summary>

[Full notes & evidence](work/records/F-015.md)

| Field | Value |
|---|---|
| PR / evidence | [#13](https://github.com/voidbrain/hobo/pull/13) |
| Opened | 2026-11-26 |
| Verification | Pending |
| Reviewed | 2026-11-26 |

</details>

---
### <a id="f-017"></a>[✨ F-017](#top)

**Axe accessibility pass per main route in the browser suite**

| Status | Priority | Effort | Remaining | Depends on | Unlocks | Agent | Procedures | Decisions |
|---|---|---|---|---|---|:---:|:---:|:---:|
| 🔴 Open | 🔹 P3 | 🟡 Medium | 3.5 h | — | — | 🤖 | — | — |

💻 **→** Next: F-017-T01 — Axe pass per main route with a seeded-violation fixture (Planned).

| | |
|---|---|
| **Issue** | NERV, bricks and openbando run axe in browser tests; Hobo has no accessibility check beyond contrast, so a missing label, a keyboard trap or a bad ARIA role would pass CI. There is no browser suite (tests run with `ng test` and `node --test` for the server), so this step also adds the runner. Evidence: [NERV practices transfer report](https://github.com/voidbrain/coordinator/blob/main/docs/reviews/2026-11-26-nerv-practices-transfer.md), inventory 13; class A item A10; missing practice M12. Owner decision 2026-11-26 in chat: "NERV practices inventory accept all" (all 22 proposals of the [report](https://github.com/voidbrain/coordinator/blob/main/docs/reviews/2026-11-26-nerv-practices-transfer.md); this record is proposal 17). |
| **Reproduce** | Read the CI workflow and the test scripts of Hobo: no axe run. Main routes: `/` (the only route). |
| **Check** | One axe pass per main route (`/` (the only route)) fails on serious and critical violations and reports moderate ones, proved by a seeded-violation fixture that fails first (F-017-T01); CI runs it on every PR (F-017-T02). |

**Feature steps**

| Effort | Step | Estimate | Actual | Remaining | Status | Depends on | Unlocks | PRs |
|---|---|---|---|---|---|---|---|---|
| 🟡 Medium | <a id="f-017-t01"></a>F-017-T01 — Axe pass per main route with a seeded-violation fixture | 2.5 h | 0 h | 2.5 h | Planned | — | [F-017-T02](#f-017-t02) | [PR #16](https://github.com/voidbrain/hobo/pull/16) plan |
| 🟢 Small | <a id="f-017-t02"></a>F-017-T02 — Run the axe pass in CI | 1 h | 0 h | 1 h | Planned | [F-017-T01](#f-017-t01) | — | [PR #16](https://github.com/voidbrain/hobo/pull/16) plan |
| 🟡 Medium | **Total** | 3.5 h | 0 h (0 of 2 steps recorded) | 3.5 h | 0 of 2 completed | | | |

<details>
<summary>Next action, estimates and evidence</summary>

[Full notes & evidence](work/records/F-017.md)

| Field | Value |
|---|---|
| PR / evidence | Steps: F-017-T01: [PR #16](https://github.com/voidbrain/hobo/pull/16) plan · F-017-T02: [PR #16](https://github.com/voidbrain/hobo/pull/16) plan. [#16](https://github.com/voidbrain/hobo/pull/16) (plan); [report](https://github.com/voidbrain/coordinator/blob/main/docs/reviews/2026-11-26-nerv-practices-transfer.md); owner decision 2026-11-26 |
| Opened | 2026-11-26 |
| Verification | Pending |
| Reviewed | 2026-11-27 |

</details>

---
### <a id="f-018"></a>[✨ F-018](#top)

**NERV write tools: add a place to a trip and set a place's image, behind NERV's approval**

| Status | Priority | Effort | Remaining | Depends on | Unlocks | Agent | Procedures | Decisions |
|---|---|---|---|---|---|:---:|:---:|:---:|
| 🔴 Open | 🔹 P3 | 🔴 Large | 5 h | [F-011-T01](#f-011-t01), [F-011-T03](#f-011-t03) | — | ⏳ | — | — |

💻 **→** Next: F-018-T01 — Write-tool contract in docs/DESIGN.md (Planned).

| | |
|---|---|
| **Issue** | Owner decision 2026-11-26 in chat: "yes to both", including adding places to Hobo trips by chat ("aggiungi Rocca Calascio al trip di agosto") via MCP behind NERV's approval. The same day the owner asked to attach an image to a place from NERV chat ("put it in chat and tell to use that, or to find some on the web, propose … and save the accepted", nerv:F-143). Hobo's MCP tools are read-only (F-011). The owner uses all modules in Italian. |
| **Reproduce** | After F-011-T01, `tools/list` on Hobo's MCP endpoint shows only list_places, get_trip and trip_totals; NERV cannot add a place or set an image. |
| **Check** | A written contract (F-018-T01); hobo_find_place and hobo_add_place_to_trip (name → geocode → owner confirms in NERV → add, F-018-T02) and hobo_set_place_image (bytes or https URL, attribution stored, F-018-T03), all validated, idempotent by requestId and annotated as writes so NERV asks first; the credit line in the gallery (F-018-T04); hobo-v1's decline case becomes a write case, Italian and English (F-018-T05). |

**Feature steps**

| Effort | Step | Estimate | Actual | Remaining | Status | Depends on | Unlocks | PRs |
|---|---|---|---|---|---|---|---|---|
| 🟢 Small | <a id="f-018-t01"></a>F-018-T01 — Write-tool contract in docs/DESIGN.md | 0.5 h | 0 h | 0.5 h | Planned | [F-011-T01](#f-011-t01) | [F-018-T02](#f-018-t02), [F-018-T03](#f-018-t03) | [PR #19](https://github.com/voidbrain/hobo/pull/19) plan |
| 🟡 Medium | <a id="f-018-t02"></a>F-018-T02 — Find a place by name and add it to a trip | 1.5 h | 0 h | 1.5 h | Planned | [F-018-T01](#f-018-t01) | [F-018-T05](#f-018-t05) | [PR #19](https://github.com/voidbrain/hobo/pull/19) plan |
| 🟡 Medium | <a id="f-018-t03"></a>F-018-T03 — Set a place's image with attribution | 1.5 h | 0 h | 1.5 h | Planned | [F-018-T01](#f-018-t01) | [F-018-T04](#f-018-t04), [F-018-T05](#f-018-t05) | [PR #19](https://github.com/voidbrain/hobo/pull/19) plan |
| 🟢 Small | <a id="f-018-t04"></a>F-018-T04 — Show the image credit in the place gallery | 0.75 h | 0 h | 0.75 h | Planned | [F-018-T03](#f-018-t03) | — | [PR #19](https://github.com/voidbrain/hobo/pull/19) plan |
| 🟢 Small | <a id="f-018-t05"></a>F-018-T05 — hobo-v1 write cases, Italian and English | 0.75 h | 0 h | 0.75 h | Planned | [F-018-T02](#f-018-t02), [F-018-T03](#f-018-t03), [F-011-T03](#f-011-t03) | — | [PR #19](https://github.com/voidbrain/hobo/pull/19) plan |
| 🔴 Large | **Total** | 5 h | 0 h (0 of 5 steps recorded) | 5 h | 0 of 5 completed | | | |

<details>
<summary>Next action, estimates and PR history</summary>

[Full notes & evidence](work/records/F-018.md)

| Field | Value |
|---|---|
| PR / evidence | Steps: F-018-T01: [PR #19](https://github.com/voidbrain/hobo/pull/19) plan · F-018-T02: [PR #19](https://github.com/voidbrain/hobo/pull/19) plan · F-018-T03: [PR #19](https://github.com/voidbrain/hobo/pull/19) plan · F-018-T04: [PR #19](https://github.com/voidbrain/hobo/pull/19) plan · F-018-T05: [PR #19](https://github.com/voidbrain/hobo/pull/19) plan. Plan: [#19](https://github.com/voidbrain/hobo/pull/19) |
| Opened | 2026-11-26 |
| Verification | Pending |
| Reviewed | 2026-11-26 |

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

**Reconciliation log:** [docs/archive/reconciliation-2026.md](archive/reconciliation-2026.md). Latest: 2026-11-27 against main `d52f88e` (#28 merged green; F-002-T02 owner walkthrough passed, T04 location walkthrough pending; T05 CI green).

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
