# Hobo style guide

How the product looks and talks, and how this repository's documents are written. Read it before changing UI (templates, component styles, global styles, user-facing text). The values live in code: CSS custom properties in [`src/styles.scss`](../src/styles.scss) (`:root`, with a dark set under `prefers-color-scheme: dark`). When this guide and the code disagree, the code is what ships: fix whichever is wrong and record the discrepancy in the backlog if it is not fixed in the same change.

Hobo is the owner's own trip planner: collect places, then build trips and compare routes. Calm and practical, like a paper map on a table: warm off-white ground, one teal accent for actions and the route line, everything else neutral. The map carries the colour; the UI stays out of its way. Shared components are written so they can move to 🧱 bricks (coordinator solution:F-012) unchanged: inputs and outputs only, tokens only, no app services.

## Documentation ownership

This guide governs the application UI and repository writing; [Backlog rules](BACKLOG-RULES.md) govern tracking. Backlog status/priority emoji are documentation cues, not app icons. README describes capabilities; AGENTS directs implementation. User instructions take precedence.

## Content and voice

- **Voice:** short, direct, addressed to the user. No "we", no exclamation marks, no emoji in the UI.
- **Sentence case** for buttons, labels and hints. Capitals come from a text style, never typed.
- **Say what happened, then what to do.** "Could not compute the route. Check the routing key in local config and try again." The home page today: "Plan a trip"; "Collect places, build trips, compare routes."
- Units and numbers: kilometres with one decimal (`12.4 km`); durations as `2 h 15 min`, `45 min` (`formatMinutes` in `src/app/core/time-spent.ts`); dates ISO in data, locale short form in the UI.

## Visual foundations

### Colour

| Token | Value (light / dark) | Use |
|---|---|---|
| `--color-bg` | `#f7f4ee / dark #12191c` | Page ground |
| `--color-surface` | `#ffffff / dark #1b2428` | Bars, cards, panels |
| `--color-text` | `#1f2a30 / dark #e8eef0` | Body text |
| `--color-muted` | `#5b6970 / dark #9aabb2` | Secondary text, hints |
| `--color-accent` | `#1d6f72 / dark #5bb8b5` | The one accent: links, primary actions, the route line |
| `--color-accent-contrast` | `#ffffff / dark #0c1416` | Text on an accent fill |
| `--color-border` | `#d9d3c7 / dark #2e3a3f` | Dividers and outlines |

- Use tokens (`var(--…)`), never a new literal colour. A new colour is a new token, added here in the same change.
- Change fill and foreground as a pair, and check contrast (WCAG AA: 4.5:1 for text, 3:1 for large text and UI parts).

### Type

No web font is loaded: `--font-body` is the system stack. Sizes: `--font-size-body` 1rem, `--font-size-small` 0.875rem, `--font-size-title` 1.5rem.

### Spacing and layout

Scale `--space-1` 0.25rem, `--space-2` 0.5rem, `--space-3` 1rem, `--space-4` 1.5rem, `--space-5` 2rem. Phone first: a single column under 720px; the map and the stop list sit side by side above it.

### Borders, radii, shadows

`--radius` 0.5rem on cards and inputs; 1px `--color-border` lines; no shadows yet.

### States and motion

- Hover, active, selected, disabled and focus each have one treatment. Focus is always visible.
- Respect `prefers-reduced-motion`: decorative motion stops, essential motion shortens.

## Components

Each shared component gets an entry here and is built to move to 🧱 bricks (coordinator solution:F-012; Hobo's F-010 tracks the move): no app services injected, tokens only. Bricks (0.3.0) has no map component yet, so the map is Hobo's own until F-010 moves it.

- **Map view** (`hobo-map-view`, [`src/app/maps/map-view.ts`](../src/app/maps/map-view.ts)): Leaflet with OpenStreetMap tiles; the attribution stays visible. Inputs `markers` (`{ location, label }`), `routes` (one line per leg, the `geometry` from `/api/maps/route`), `tiles` and `label` (the region's accessible name). Route lines in `--color-accent`; markers are `--color-accent` dots with a `--color-surface` ring and the place name as tooltip; a visually hidden list reads the places out. A 1px `--color-border` frame with `--radius`, at least 16rem tall. It fits its view to the markers and lines.

## Accessibility

- Every interactive element is reachable and operable by keyboard, with a visible focus and an accessible name.
- Colour never carries meaning alone. Text meets WCAG AA contrast on its real background.
- Images that carry meaning have alt text; decorative ones have `alt=""`.

## Assets

Static assets live in `public/`. Place photos are the owner's data and stay out of git (F-002-T03): they live in the local server's git-ignored data folder, with GPS metadata stripped on import. Map tiles are © OpenStreetMap contributors and the attribution stays visible on every map.

## Writing in this repository

- Plain English, short sentences, active voice. Say what is, not what might be.
- Name things as the code names them: files, functions, commands in backticks, linked when they are paths.
- Dates are absolute (`2026-10-29`), never "yesterday" or "last week".
- One owner per fact: link to it rather than restating it. AGENTS for how to work, the backlog for status, this guide for look and voice, README for what the product does.

## Keeping it in step

A change that adds or alters a token, a text style, a shared component or the voice updates this guide in the same PR. A design doc that disagrees with the code becomes a backlog record.
