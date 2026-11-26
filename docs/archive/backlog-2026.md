# Closed backlog — 2026

Closed records, moved from the [active backlog](../BACKLOG.md) with their full history. Dated evidence, not current status.

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
