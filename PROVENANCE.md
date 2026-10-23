# Provenance

This repository is an independent, versioned snapshot of the read-only Jermilova BN-RRM
viewer. It was extracted once from the source repository below. There is no automatic
synchronization in either direction: later changes to the source repository do not reach
this repository, and changes made here do not reach the source.

| Item | Value |
|---|---|
| Source repository | https://github.com/JasenNelson/SSTAC-Dashboard |
| Source commit | `1519044c8d10692da0fe5381fce2cc6bd115f1f8` (merge of pull request #822) |
| Source route | `/Jermilova` (https://sstac-dashboard.vercel.app/Jermilova) |
| Source package | `viewers/jermilova-public/` plus the shared modules it imported from `src/` |
| Extraction date | 2026-10-23 |
| Data pack | `bnrrm-casestudy-jermilova2025-mackenzie-hg` (19 files, listed in `asset-manifest.json`) |
| Licence | Software: Apache-2.0 (`LICENSE`); the source repository's MIT notice is kept verbatim in `LICENSES/MIT.txt` for the copied portions (`NOTICE`). Data: CC BY-NC-SA 4.0 (`DATA_LICENSE.md`) |

## How the snapshot was taken

- File bytes were read from the source commit itself (`git archive` of that commit), not
  from a working copy. No source history was copied.
- Every copied file is byte-identical to the source commit unless listed under "Changed
  for the standalone repository" below.
- Dependency versions are the exact versions in the source repository's lockfile at that
  commit (all 579 resolved packages match); `package-lock.json` here contains only this
  repository's own dependency tree.

## What was copied

| Source (at the commit) | Here |
|---|---|
| `viewers/jermilova-public/app/`, `components/JermilovaViewerClient.tsx`, `components/PackLoadState.tsx` | same paths |
| `viewers/jermilova-public/forked/` (5 read-only component forks) | `forked/` |
| `viewers/jermilova-public/forked/networkStore.ts`, `siteDataStore.ts` (read-only store forks) | `src/stores/bn-rrm/` (they replace the originals at their import path) |
| `viewers/jermilova-public/lib/` (pack loader, runtime validator, verifying fetch and their tests) | `lib/` |
| `viewers/jermilova-public/viewer-capabilities.ts`, `asset-manifest.json`, `claim-register.json` | repository root |
| `viewers/jermilova-public/scripts/audit-export*.mjs`, `preview-server.js` | `scripts/` |
| `viewers/jermilova-public/public/bn-rrm/` (registry and the 19 pack files) | `public/bn-rrm/` |
| 26 shared modules from `src/` (BN-RRM components, hooks, libraries, types, `utils/cn.ts`, `lib/maps/wms-identify.ts`, `stores/bn-rrm/packStore.ts`) | same paths under `src/`, now owned here |
| `src/app/globals.css` (the original application stylesheet) | `app/bnrrm-base.css` |
| `LICENSE` (MIT) | `LICENSES/MIT.txt` (byte-identical); `LICENSE` is now Apache-2.0 |

Not copied: the source repository's other features, authentication, database clients,
API routes, middleware, environment files, deployment settings, internal handoffs, review
evidence, gate logs, the unmodified originals of the forked files, the fork-patch and
source-closure pin tooling (which compares against those originals), and the earlier
preview components that the viewer no longer mounts. The deletion-only differences
between each fork and its original are recorded in the source repository at
`viewers/jermilova-public/forked/FORK_PATCHES/` at the commit above.

## Changed for the standalone repository

- Served from the site root `/` instead of `/Jermilova`: no `basePath`; the verifying
  fetch uses the default empty base path (`components/JermilovaViewerClient.tsx`).
- New configuration owned here: `package.json`, `package-lock.json`, `next.config.ts`,
  `tsconfig.json` (`@/*` maps to `./src/*`), `eslint.config.mjs`, `vitest.config.ts`,
  `playwright.config.ts`, `vercel.json`, `.github/workflows/ci.yml`.
- `app/globals.css` imports the copied stylesheet instead of the source application's.
- `app/layout.tsx` adds `robots: noindex, nofollow` metadata.
- Security headers move from the source application's server configuration to
  `vercel.json`; the inline-script policy is derived from each build
  (`scripts/csp.mjs`).
- New scripts: `scripts/check-assets.mjs` (public-file allowlist), `scripts/csp.mjs`,
  `scripts/build-monitored.mjs`. `scripts/audit-export.mjs` and
  `scripts/preview-server.js` were adapted to the root path.
- Tests that compared against files in the source repository were made self-contained:
  `lib/jermilovaParity.test.tsx` and `lib/verifiedFetch.test.ts` (one-sided, against
  recorded source behavior), `lib/assets.test.ts`, `lib/auditCore.test.ts`,
  `lib/loadJermilovaPack.test.ts` (two reference marginals embedded; see the comment
  there). New: `lib/standaloneScope.test.ts`, `lib/csp.test.ts`, `e2e/`.
- Comments that described the source application's layout were reworded.
- `forked/SiteMap.tsx` (map attribution; the only copied component code that changed):
  - the Topographic basemap shows OpenTopoMap's full attribution (OpenStreetMap
    contributors, SRTM, OpenTopoMap map style, CC-BY-SA) instead of "(c) OpenTopoMap" only;
  - the Streets basemap uses OpenStreetMap's canonical tile URL
    (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`) and its linked copyright attribution;
  - the Esri imagery and Stamen terrain basemaps are removed, with their hosts removed from
    the security policy and the browser tests;
  - the BC WMS overlays show the Open Government Licence - British Columbia
    acknowledgment with a link, and the pack's map layers credit the FRDR dataset;
  - the file is plain ASCII: em dashes in two comments became " - ", and the two in tooltip
    attributes became the `&mdash;` entity, which renders the same text.
- `components/JermilovaViewerClient.tsx` renders a "Data and licensing" notice
  (`components/DataLicensingNotice.tsx`) below the viewer.
- Licensing: the software is relicensed to Apache-2.0 (`LICENSE`, `NOTICE`,
  `package.json`); the MIT notice is preserved in `LICENSES/MIT.txt`; the research data
  are documented as CC BY-NC-SA 4.0 in `DATA_LICENSE.md`, which links to the licence at
  https://creativecommons.org/licenses/by-nc-sa/4.0/ rather than bundling its text.
- The export audit also forbids the removed basemap hosts and the two FRDR identifiers that
  are not this dataset's; `lib/licensing.test.tsx` checks the licence files, notices and
  layer sources.
- `npm run build` also runs the pack-loader test (`npm run check:pack`), so the claim
  register and runtime checks run before every deployment build.

## Data

The 19 data files are copies of the files the source viewer serves anonymously at the
source route. Fifteen are byte-identical. Four (`pack.json`, `review/model_overview.json`,
`review/provenance_registry.json`, `training_data.json`) differ only in the FRDR dataset
identifier: the copied files cited identifiers that are not this dataset's (one names an
unrelated FRDR dataset, the other does not resolve), and they now cite
doi:10.20383/103.0957, the version the article's data-availability statement cites. No
other byte changed. `scripts/correct-frdr-doi.mjs` records each file's source SHA-256,
applies the change, and recomputes `asset-manifest.json`, `claim-register.json` and the
pins in `scripts/check-assets.mjs`; `--check` (also run by `lib/licensing.test.tsx`) proves
that reverting the identifier gives back the exact source bytes. The claim register's
displayed values, the model and every scientific value are unchanged.

- Model, training data and review files: the pack's own records (`pack.json` `reference`,
  `review/provenance_registry.json`) attribute them to Jermilova et al. 2025 (Integrated
  Environmental Assessment and Management 21(2):396-413, doi:10.1093/inteam/vjae011), the
  authors' R analysis code, and the FRDR dataset deposited by Una Jermilova and Holger
  Hintelmann (doi:10.20383/103.0957; current version doi:10.20383/103.01279, from which no
  data were refreshed). The dataset is licensed CC BY-NC-SA 4.0.
- Twelve map layers (`map/*.geojson`): GeoJSON files that correspond to layers in the FRDR
  spatial dataset. Each local GeoJSON layer was matched to a layer the FRDR README describes
  by feature-count and field correspondence; the local files were not directly
  byte-compared with the deposited spatial files. `DATA_LICENSE.md` maps each local file to
  that layer and to the upstream source the README records.
- Basemap tiles are not copied; the map loads them from their providers at view time
  (OpenStreetMap, OpenTopoMap, and the British Columbia government WMS).

Licence and attribution for the data are in `DATA_LICENSE.md`. The Apache License 2.0 in
`LICENSE` covers the software only.
