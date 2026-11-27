# Closed backlog — 2026

Closed records, moved from the [active backlog](../BACKLOG.md) with their full history. Dated evidence, not current status.

<!-- archive-recap:start -->
## Weekly closure recaps

Closed records in this archive, grouped by closing date (Monday–Sunday). Links open the first section for that week; current status stays in the active backlog.

| Closing week | Features closed | Bugs closed |
|---|---:|---:|
| [2026-11-23 – 2026-11-29](#archive-week-2026-11-23) | 2 | 0 |
<!-- archive-recap:end -->

<a id="archive-week-2026-11-23"></a>
## Closed 2026-11-26

### F-012

**Shared maps/geo package with openbando (candidate)**

| Signal | Priority | Status | Effort |
|:---:|---|---|---|
| 🔵 | ◻️ P3 | Closed | 🟢 Small |

💻 **→ Human action required: No**<br />Closed 2026-11-26: solution:F-016-T08 review docs/reviews/2026-11-shared-assets/blocks.md (verdict: not yet; owner 'ok to all' 2026-11-26), hobo#17.

| | |
|---|---|
| **Issue** | The maps and geo domain is shared with openbando, which uses Leaflet and its own geo maths in `src/app/core/geo.ts`. A shared package could serve both. This is a candidate, not a decision. |
| **Reproduce** | — |
| **Check** | A dated comparison of Hobo's `src/app/maps/` and openbando's geo code lists the shared functions and proposes, for a function both projects would import, a package in blocks (through a coordination record); or the record closes with the reason not to share. |

<details>
<summary>Next action, estimates and PR history</summary>

**Next action / closure evidence:** Closed 2026-11-26: solution:F-016-T08 review docs/reviews/2026-11-shared-assets/blocks.md (verdict: not yet; owner 'ok to all' 2026-11-26), hobo#17. 2026-11-25: step plan adopted with the record (owner-approved project setup, `workItems.featurePlans`): F-012-T01.

2026-11-26: cross-project audit proposal 7, accepted by the owner in chat 2026-11-26 ("accept all 17 proposals"): F-012-T01 compares `src/app/maps` with openbando's `core/geo.ts`; a function both would import is proposed as a blocks package through a coordination record, otherwise the step closes with the reason (shared domain logic goes to blocks only once two projects import it, not to the coordinator; DOMAINS.md). PR [#13](https://github.com/voidbrain/hobo/pull/13).

**Estimates:** No remaining effort.

| Field | Value |
|---|---|
| PR / evidence | [#1](https://github.com/voidbrain/hobo/pull/1) |
| Opened | 2026-11-25 |
| Verification | Pending |
| Reviewed | 2026-11-25 |

</details>

---

## Closed 2026-11-27

### F-001

**Angular scaffold and project harness**

| Signal | Priority | Status | Effort |
|:---:|---|---|---|
| 🔵 | ◻️ P2 | Closed | 🟢 Small |

💻 **→ Human action required: No**<br />Closed 2026-11-27: #1 (CI 45701898058) and #3 (CI 45711964797) merged on green CI; branch protection and auto-merge active.

| | |
|---|---|
| **Issue** | Hobo needs an Angular 22 app (standalone components, signals, strict TypeScript and templates) and the 🦺 project harness (core + angular) before feature work starts. Approved by the owner on 2026-11-25. |
| **Reproduce** | `npm ci && npm run check:fast && npm test && npm run build` on a fresh clone. |
| **Check** | The first PR's CI (`check` job) is green: harness checks, lint, format, unit tests with coverage, type check and build. Branch protection and auto-merge are set by the owner. |

<details>
<summary>Next action, estimates and PR history</summary>

**Next action / closure evidence:** Closed 2026-11-27: #1 (CI 45701898058) and #3 (CI 45711964797) merged on green CI; branch protection and auto-merge active. 2026-11-25: step plan adopted with the record (owner-approved project setup, `workItems.featurePlans`): F-001-T01, F-001-T02.

2026-11-25: F-001-T02 closed. The owner applied the settings on 2026-11-25; verified the same day with `gh api repos/voidbrain/hobo/branches/main/protection`: a pull request is required (0 approvals), required status check `check`, enforce_admins on, force-pushes and deletions off; and `gh api repos/voidbrain/hobo`: allow_auto_merge and delete_branch_on_merge on.

**Estimates:** No remaining effort.

| Field | Value |
|---|---|
| PR / evidence | [#1](https://github.com/voidbrain/hobo/pull/1); [#3](https://github.com/voidbrain/hobo/pull/3) |
| Opened | 2026-11-25 |
| Verification | Unit/integration · 2026-11-27 · #1 CI 45701898058 and #3 CI 45711964797 green; repository settings verified |
| Reviewed | 2026-11-27 |

</details>

---
