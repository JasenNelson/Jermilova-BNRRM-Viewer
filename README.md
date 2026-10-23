# Mackenzie Mercury Bayesian Network Viewer (Jermilova et al. 2025)

A read-only web viewer for a packaged reconstruction of the Mackenzie River Basin mercury
Bayesian network relative risk model (BN-RRM) described in Jermilova et al. 2025,
Integrated Environmental Assessment and Management 21(2):396-413.

It has six tabs:

- **Guide** - how to read the model.
- **Conceptual** - the high-level causal groups.
- **Detailed BN** - the full 14-node network. Groups start collapsed; click a group to
  expand it, or use the expand-all and collapse-all buttons. Click a node to inspect it.
- **CPT** - the conditional probability tables.
- **Map** - the study area and reference layers.
- **Data** - the published training data.

You can try "what-if" scenarios: click a node, then click one of its states to set it as
evidence, and the results update. This happens only in your browser tab. Nothing is saved
or sent anywhere; reloading the page restores the original state.

The results are an independent reconstruction for exploration. The viewer shows its own
caveats on screen (for example, that agreement with the paper's regional predictions has
not been established).

## What it needs

Nothing secret. The viewer is a static website: plain HTML, JavaScript, CSS and data files.

- No login, accounts, passwords or API keys.
- No environment variables.
- No database and no server code.
- It does not store anything in the browser (no cookies, local storage or offline caches).

Where it came from, and what was changed, is recorded in [PROVENANCE.md](PROVENANCE.md).

## Publish it on your own GitHub and Vercel accounts

### 1. Get the code into a GitHub repository you own

Either:

- **Receive a transferred repository.** If the repository is created on someone else's
  GitHub account first, they can transfer it to you (GitHub: repository Settings ->
  General -> Danger Zone -> Transfer ownership). Accept the transfer email.
- **Create it yourself.** Sign in to GitHub, choose New repository, give it a name (for
  example `jermilova-bnrrm-viewer`), leave it empty (no README, licence or .gitignore),
  and create it. Then, from a copy of this folder on your computer:

  ```
  git remote add origin https://github.com/<your-account>/<repository-name>.git
  git push -u origin main
  ```

Public or private repositories both work with Vercel.

### 2. Import the repository into Vercel

1. Sign in to https://vercel.com with your GitHub account.
2. Choose **Add New... -> Project**, then **Import** next to your repository (allow
   Vercel to access it if asked).
3. On the configuration screen:
   - **Framework Preset:** Next.js (it is also set in `vercel.json`).
   - **Root Directory:** leave it as the repository root (`./`).
   - **Build and Output Settings:** leave the defaults. `vercel.json` sets the install
     command (`npm ci`) and the build command (`npm run build`).
   - **Environment Variables:** none. Add nothing.
4. Choose **Deploy**. The first build takes a minute or two. Vercel then shows the site
   address (for example `https://<project-name>.vercel.app`).

Every later push to the `main` branch deploys automatically.

### 3. Check the deployed page

Open the site address and check:

- The page shows the six tabs, and the top right says **14 nodes** once it has loaded.
- Detailed BN shows seven collapsed groups; expand-all shows all 14 nodes.
- Each tab opens. (The Map tab needs a wide window, or hide the side panels with the two
  buttons at the top right.)

Optional technical checks:

- In the browser's developer tools (Network tab), reload: every request is a GET, the
  viewer's own files come from your site address, and map tiles come from the map tile
  services only.
- In a terminal: `curl -I https://<your-site>/` shows `x-robots-tag: noindex, nofollow`,
  `x-frame-options: DENY` and a `content-security-policy` header.
- If the page shows "Approved pack unavailable", a data file did not match its recorded
  checksum. Redeploy from an unmodified copy of the repository.

The site asks search engines not to index it (`noindex, nofollow`). That is a request to
search engines, not access control: anyone with the address can open it. To allow
indexing, remove the `X-Robots-Tag` header from `vercel.json` (and the expected copy in
`scripts/csp.mjs`) and the `robots` line in `app/layout.tsx`.

## Making future updates

This repository is a stand-alone copy. Nothing updates it automatically; change it here
and push.

You need Node.js 22 (https://nodejs.org) and Git. Then, in this folder:

```
npm ci                 # install the exact dependency versions in package-lock.json
npm run dev            # optional: live preview at http://localhost:3000
npm run lint           # code style
npm run typecheck      # TypeScript
npm test               # unit and integration tests
npm run build          # production build into out/, then the security and asset checks
npx playwright install chromium   # once, for the browser tests
npm run test:e2e       # browser tests at desktop and phone widths
```

Commit your change and push to `main`; Vercel deploys it. GitHub Actions runs the same
checks on every push and pull request (`.github/workflows/ci.yml`).

Things to know when changing it:

- **Page text and code.** Edit freely. The build works out the page's security policy
  for scripts from the built page itself, so there is no list of hashes to maintain.
- **Data files** (`public/bn-rrm/`). Each file's size and SHA-256 are recorded in
  `asset-manifest.json`, which is itself pinned in `scripts/check-assets.mjs`, and the
  registry is pinned in `scripts/check-assets.mjs` and `lib/verifiedFetch.ts`. The text
  the viewer displays from `pack.json`, the model and the training data is bound to those
  files in `claim-register.json` (artifact SHA-256 plus a hash of each displayed value);
  the register itself is pinned in `scripts/check-assets.mjs`, and its 14 claim rows are
  listed in `lib/assets.test.ts`. Replacing a data file therefore means updating all of
  these records, and the expected
  values in `lib/loadJermilovaPack.test.ts`. `npm run build` runs the viewer's own pack
  loader against the shipped files before building (`npm run check:pack`), so a stale
  record stops the build instead of reaching the deployed page. Any file added to
  `public/` that is not in the manifest also stops the build. The one change made here to
  pack bytes (the FRDR dataset identifier) is reproducible and checkable with
  `node scripts/correct-frdr-doi.mjs --check`.
- **New outside services** (another map tile server, for example) must be added to the
  policy in `scripts/csp.mjs` and copied into `vercel.json`; the tests check the two match.
- `npm run test:parity` compares this copy with the original published viewer at
  https://sstac-dashboard.vercel.app/Jermilova (anonymous, read-only). It is optional and
  only meaningful while that page exists.

## Licence and attribution

This repository contains material under different licences:

- **Software: Apache License 2.0** ([LICENSE](LICENSE)). It covers the code, scripts,
  configuration and software documentation, and nothing else. Portions copied or adapted
  from the SSTAC-Dashboard repository keep their original MIT notice ("Copyright (c) 2025
  JasenNelson"), preserved unchanged in [LICENSES/MIT.txt](LICENSES/MIT.txt);
  [NOTICE](NOTICE) explains how the two relate. Keep `LICENSE`, `NOTICE` and `LICENSES/`
  when you copy, change or redistribute this repository.
- **Research data: CC BY-NC-SA 4.0** ([DATA_LICENSE.md](DATA_LICENSE.md)). The data pack
  under `public/bn-rrm/` is adapted from the dataset Una Jermilova and Holger Hintelmann
  deposited in the Federated Research Data Repository: doi:10.20383/103.0957, the version
  the article cites (the current version is doi:10.20383/103.01279; the data here were not
  refreshed from it). The Apache License does not apply to these data. DATA_LICENSE.md
  gives the citation, the changes made, and the recorded sources of all twelve map layers;
  those upstream sources keep their own terms.
- **Map services**: basemap tiles (OpenStreetMap, OpenTopoMap) and the optional British
  Columbia overlays are loaded from their providers at view time under the providers'
  terms. Their credits appear in the map's attribution control.

The page shows a short "Data and licensing" notice below the viewer, with the citation,
the licence, what was changed, and the map-layer sources.

The repository as a whole is therefore not under one licence, and it is not entirely open
source: the bundled data carry a NonCommercial restriction. Any public deployment of the
site must be genuinely noncommercial in the licence's sense ("not primarily intended for or
directed towards commercial advantage or monetary compensation"); offering it free of
charge does not by itself decide that. Making the repository or the site public remains
the owner's decision. A private GitHub repository also works with Vercel.

## Vercel plan and Vercel Toolbar

- Whether this site can run on Vercel's free Hobby plan is governed by Vercel's current
  terms and fair-use rules, which can change (at the time of writing, Hobby is for
  personal, non-commercial use). Check them for your situation before choosing a plan.
- The Vercel Toolbar is optional and is turned on or off per Vercel project in that
  project's settings. It is not needed for this site. If it is enabled on preview
  deployments, this site's security policy may block the toolbar's script (you may see a
  console message); the viewer itself is unaffected.

## Known layout facts (inherited from the original viewer)

- At phone width (about 390 px) both side panels stay open, which leaves the Detailed BN
  canvas and the Map with no room; hide the panels with the two buttons at the top right.
  At that width the model title card also sits over the canvas expand/collapse buttons.
- The model has 15 causal links, and all 15 are used in the calculations, but the network
  drawing shows 14 arrows (MeHg Ingested -> pTWI Exceedance is not drawn).
- The Guide mentions a Review tab that this read-only viewer does not include. "20 nodes"
  can show briefly before the data loads. Light theme only.
- The Map offers two basemaps, Streets (OpenStreetMap) and Topographic (OpenTopoMap). The
  original viewer's Esri imagery and Stamen terrain basemaps were removed here (see
  DATA_LICENSE.md).

## Repository layout

| Path | Contents |
|---|---|
| `app/` | Page entry, layout and stylesheets |
| `components/` | Integrity gate that verifies the data pack before the viewer mounts |
| `forked/` | Read-only versions of the original BN-RRM page, canvas, results, map and site panels |
| `src/` | The original BN-RRM components, stores, libraries and types the viewer uses |
| `lib/` | Data-pack loader, runtime validator, verifying fetch, and the unit tests |
| `public/bn-rrm/` | The data pack (19 files) and its one-pack registry |
| `scripts/` | Asset check, security-policy step, export audit, local preview server, monitored build |
| `e2e/` | Browser tests |
| `asset-manifest.json`, `claim-register.json`, `viewer-capabilities.ts` | Data-pack checksums, verified display claims, pack and model identifiers |
| `vercel.json` | Vercel settings and security headers |
| `LICENSE`, `NOTICE`, `LICENSES/`, `DATA_LICENSE.md` | Software licence (Apache-2.0), preserved MIT notice, data licence (CC BY-NC-SA 4.0) and attribution |
