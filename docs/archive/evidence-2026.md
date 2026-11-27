# Archived evidence — 2026

## F-002

2026-11-25: F-002-T03 implemented in [#7](https://github.com/voidbrain/hobo/pull/7): added `server/images.ts` (`sanitizeImage`, `MAX_IMAGE_BYTES = 5_000_000`, magic-byte and container validation for JPEG/PNG/WebP, stripping EXIF/GPS/XMP/IPTC/comment metadata), `/api/places/:id/images` upload/serve/delete endpoints writing `<uuid>.<ext>` under git-ignored `<dataDir>/images`, `PlacesApi` image methods, and `<hobo-place-images>` thumbnails in `src/app/pages/places/place-images.ts`; tested with in-memory synthetic test images (zero image files in git).

2026-11-25: F-002-T01 implemented: `server/` with `node:sqlite`, the shared place model and validation, the `PlacesApi` client and `docs/DESIGN.md`; API, store, persistence-across-restart and client tests.

2026-11-25: step plan adopted with the record (owner-approved project setup, `workItems.featurePlans`): F-002-T01, F-002-T02, F-002-T03, F-002-T04, F-002-T05.

| PR / evidence | Earlier evidence |
|---|---|
| PRs and reviews | [#1](https://github.com/voidbrain/hobo/pull/1); [#2](https://github.com/voidbrain/hobo/pull/2) (review fixes); [#5](https://github.com/voidbrain/hobo/pull/5) (F-002-T01, CI 45713057220); [#7](https://github.com/voidbrain/hobo/pull/7) (F-002-T03, CI 45721078554); Test: `server/images.test.ts`, `src/app/pages/places/place-images.spec.ts`, `src/app/data/places-api.spec.ts` (`4dbecd4`); Review: 2026-11-26 Claude (Opus), fixed an announced oversized upload being read before its 413; added real GPS EXIF, place deletion and path tests; [#23](https://github.com/voidbrain/hobo/pull/23); [#24](https://github.com/voidbrain/hobo/pull/24); Review: fresh-context design review 2026-11-27, findings fixed in #24; [#25](https://github.com/voidbrain/hobo/pull/25) |

