// Licensing, attribution and dataset-identifier checks (see DATA_LICENSE.md and NOTICE).
// Any of these failing stops `npm test` and CI: a wrong FRDR identifier coming back, the
// software and data licences being conflated, a required notice or layer source going
// missing, or a removed basemap host returning.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import assetManifest from '../asset-manifest.json';
import {
  CURRENT_VERSION_DOI,
  DataLicensingNotice,
  MAP_LAYER_SOURCES,
  SOURCE_VERSION_DOI,
} from '../components/DataLicensingNotice';
import { FORBIDDEN_MARKERS } from '../scripts/audit-export-core.mjs';
import { CORRECTIONS, WRONG_FRDR_DOIS, checkCorrection } from '../scripts/correct-frdr-doi.mjs';
import { MAP_IMAGE_HOSTS } from '../scripts/csp.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(path.join(repoRoot, ...rel.split('/')), 'utf8');
// Documents are checked with line wrapping collapsed to single spaces.
const doc = (rel: string) => read(rel).replace(/\s+/g, ' ');
const sha256 = (rel: string) => createHash('sha256').update(readFileSync(path.join(repoRoot, ...rel.split('/')))).digest('hex');

// Every file in the working tree except dependencies, build output and test output.
const SKIP = new Set(['.git', 'node_modules', '.next', 'out', 'coverage', 'test-results', 'playwright-report', '.evidence']);
function repositoryFiles(dir = ''): string[] {
  return readdirSync(path.join(repoRoot, dir)).flatMap((name) => {
    if (SKIP.has(name)) return [];
    const rel = dir ? `${dir}/${name}` : name;
    return statSync(path.join(repoRoot, rel)).isDirectory() ? repositoryFiles(rel) : [rel];
  });
}

// Removed basemaps (DATA_LICENSE.md, "Removed basemaps").
const RETIRED_HOSTS = ['stamen-tiles.a.ssl.fastly.net', 'server.arcgisonline.com'];

describe('dataset identifiers', () => {
  it('no repository file carries either FRDR identifier that is not this dataset', () => {
    expect(WRONG_FRDR_DOIS).toHaveLength(2);
    const hits: string[] = [];
    for (const file of repositoryFiles()) {
      const text = readFileSync(path.join(repoRoot, ...file.split('/'))).toString('latin1');
      for (const doi of WRONG_FRDR_DOIS) if (text.includes(doi)) hits.push(`${file}: ${doi}`);
    }
    expect(hits).toEqual([]);
  });

  it('changed only the identifier: reverting it gives the exact source bytes, and the integrity records are current', async () => {
    expect(CORRECTIONS.map((entry: { key: string }) => entry.key)).toEqual(['pack', 'model_overview', 'provenance', 'training_data']);
    expect(await checkCorrection()).toEqual([]);
    const record = (assetManifest.provenance as { identifier_correction?: { files: Array<{ path: string; source_sha256: string }> } }).identifier_correction;
    expect(record?.files.map(({ path: p, source_sha256 }) => ({ path: p, source_sha256 }))).toEqual(
      CORRECTIONS.map((entry: { path: string; source_sha256: string }) => ({ path: entry.path, source_sha256: entry.source_sha256 })),
    );
  });

  it('cites the source version the article cites, and names the current version separately', () => {
    const pack = JSON.parse(read('public/bn-rrm/packs/bnrrm-casestudy-jermilova2025-mackenzie-hg/pack.json'));
    expect(pack.reference.data_repository).toBe(`FRDR (https://doi.org/${SOURCE_VERSION_DOI})`);
    expect(SOURCE_VERSION_DOI).toBe('10.20383/103.0957');
    expect(CURRENT_VERSION_DOI).toBe('10.20383/103.01279');
    for (const file of ['DATA_LICENSE.md', 'README.md', 'PROVENANCE.md', 'NOTICE']) {
      expect(doc(file), file).toContain(SOURCE_VERSION_DOI);
    }
    for (const file of ['DATA_LICENSE.md', 'README.md', 'PROVENANCE.md']) {
      expect(doc(file), file).toContain(CURRENT_VERSION_DOI);
    }
    expect(doc('DATA_LICENSE.md')).toContain('No data in this repository was refreshed from, or re-derived from, Version 2');
  });
});

describe('software and data licences stay separate', () => {
  it('licenses the software under the unmodified Apache License 2.0', () => {
    // SHA-256 of https://www.apache.org/licenses/LICENSE-2.0.txt
    expect(sha256('LICENSE')).toBe('cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30');
    expect(JSON.parse(read('package.json')).license).toBe('Apache-2.0');
    expect(JSON.parse(read('package-lock.json')).packages[''].license).toBe('Apache-2.0');
  });

  it('preserves the MIT notice of the copied source code, byte for byte, and references it', () => {
    // SHA-256 of LICENSE at SSTAC-Dashboard commit 1519044c8d10692da0fe5381fce2cc6bd115f1f8
    expect(sha256('LICENSES/MIT.txt')).toBe('233bed1e434b9037c3595bf2de426a43ee264ae316637ef2dce4590954e351f2');
    expect(read('LICENSES/MIT.txt')).toContain('Copyright (c) 2025 JasenNelson');
    const notice = doc('NOTICE');
    expect(notice).toContain('Apache License, Version 2.0');
    expect(notice).toContain('LICENSES/MIT.txt');
    expect(notice).toContain('1519044c8d10692da0fe5381fce2cc6bd115f1f8');
    expect(notice).toContain('does not displace any right or notice of a third party');
  });

  it('licenses the research data under CC BY-NC-SA 4.0 and says the Apache License does not cover them', () => {
    // The CC legal code is linked, not bundled (repository files are plain ASCII, and the
    // legal text must not be altered to make it so).
    expect(readdirSync(path.join(repoRoot, 'LICENSES'))).toEqual(['MIT.txt']);
    expect(doc('NOTICE')).toContain('https://creativecommons.org/licenses/by-nc-sa/4.0/');
    const data = doc('DATA_LICENSE.md');
    expect(data).toContain('The Apache License 2.0 in `LICENSE` covers the software only');
    expect(data).toContain('It does not cover the research data');
    expect(data).toContain('https://creativecommons.org/licenses/by-nc-sa/4.0/');
    expect(data).toContain('Una Jermilova');
    expect(data).toContain('Holger Hintelmann');
    expect(data).toContain('https://doi.org/10.1093/inteam/vjae011');
    expect(data).toContain('Changes made');
    expect(data).toContain('genuinely noncommercial');
    expect(data).toContain('Licensor has');
    expect(doc('NOTICE')).toContain('Research data (not covered by the Apache License)');
    const readme = doc('README.md');
    expect(readme).toContain('The Apache License does not apply to these data');
    expect(readme).toContain('not entirely open');
    expect(readme).toContain('genuinely noncommercial');
  });

  // Statements that would put the research data under a software licence, or the whole
  // repository under Apache-2.0. A clause containing "not" or "only" is a scope limit, not a
  // claim, so it is not matched.
  const DATA = String.raw`(?:research\s+)?(?:data(?:\s+pack)?|datasets?|map\s+layers?)`;
  const SOFTWARE_LICENCE = String.raw`(?:apache|mit)(?:-2\.0|\s+2\.0|\s+licen[cs]e(?:,?\s+version\s+2\.0|\s+2\.0)?)?`;
  // The whole repository (not "the software in this repository", which is a scope limit).
  const WHOLE = String.raw`(?<!\bsoftware\s+(?:in|of)\s+(?:this\s+|the\s+)?)(?:(?:this|the)\s+)?(?:(?:entire|whole)\s+)?(?:repository|repo|project|codebase|everything|all\s+(?:files|contents|content))(?:\s+as\s+a\s+whole)?`;
  const NO_NEGATION = String.raw`(?:(?!\bnot\b)[^.;])`;
  const CONFLATION = [
    // Data under a software licence.
    new RegExp(String.raw`\b${DATA}\b${NO_NEGATION}{0,60}?\b(?:is|are|remain)\s+(?:licensed|released|distributed|available)\s+under\s+(?:the\s+)?${SOFTWARE_LICENCE}`, 'i'),
    new RegExp(String.raw`\b${DATA}\b${NO_NEGATION}{0,40}?\b(?:is|are)\s+${SOFTWARE_LICENCE}(?:[-\s]licensed)?\b`, 'i'),
    new RegExp(String.raw`\b${SOFTWARE_LICENCE}\b(?:(?!\bnot\b|\bonly\b)[^.;]){0,60}?\b(?:covers?|applies\s+to|governs)\s+(?:the\s+|these\s+|all\s+)?${DATA}\b`, 'i'),
    new RegExp(String.raw`\b${SOFTWARE_LICENCE}[-\s]licensed\s+${DATA}\b`, 'i'),
    // The whole repository under a software licence: verb, adjective and "covers" forms.
    new RegExp(String.raw`\b${WHOLE}\b${NO_NEGATION}{0,40}?\b(?:is|are)\s+(?:entirely\s+|fully\s+|wholly\s+)?(?:licensed|released|distributed|available|covered)\s+(?:entirely\s+)?under\s+(?:the\s+)?${SOFTWARE_LICENCE}`, 'i'),
    new RegExp(String.raw`\b${WHOLE}\b${NO_NEGATION}{0,40}?\b(?:is|are)\s+(?:entirely\s+|fully\s+|wholly\s+)?${SOFTWARE_LICENCE}(?:[-\s]licensed)?\b`, 'i'),
    new RegExp(String.raw`\b${SOFTWARE_LICENCE}\b(?:(?!\bnot\b|\bonly\b)[^.;]){0,60}?\b(?:covers?|applies\s+to|governs)\s+(?:the\s+)?(?:entire\s+|whole\s+)?(?:repository|project|codebase|everything|all\s+files)\b`, 'i'),
    new RegExp(String.raw`\b${SOFTWARE_LICENCE}[-\s]licensed\s+(?:repository|project|codebase)\b`, 'i'),
    new RegExp(String.raw`\blicen[cs]e\s*:\s*${SOFTWARE_LICENCE}\b`, 'i'),
    // "Entirely open source" for the whole repository.
    new RegExp(String.raw`\b${WHOLE}\b${NO_NEGATION}{0,40}?\b(?:is|are)\s+(?:entirely|fully|completely|wholly|100%)\s+open[-\s]source`, 'i'),
    /released under the MIT licence/i,
    /sources and licences are not recorded|confirm that the data's terms allow redistribution/i,
  ];

  it('the conflation patterns catch data-under-Apache and whole-repository claims and pass scope limits', () => {
    const bad = [
      'The data pack is Apache-2.0 licensed.',
      'The research data are licensed under the Apache License 2.0.',
      'The Apache License covers the research data.',
      'Map layers are released under the MIT licence.',
      'Apache-2.0 licensed data.',
      'The repository as a whole is licensed under the Apache License.',
      'The repository is Apache-2.0 licensed.',
      'This repository is Apache 2.0.',
      'All files are MIT licensed.',
      'The entire project is licensed under the Apache License, Version 2.0.',
      'Everything here is released under Apache-2.0.',
      'The Apache License 2.0 covers the entire repository.',
      'An Apache-2.0 licensed repository.',
      'License: Apache-2.0',
      'The project is entirely open source.',
    ];
    for (const sentence of bad) expect(CONFLATION.some((re) => re.test(sentence)), sentence).toBe(true);
    const good = [
      'The Apache License 2.0 in `LICENSE` covers the software only.',
      'The Apache License does not apply to these data.',
      'The viewer software is licensed under the Apache License 2.0, which does not cover the data.',
      'The adapted data remain under CC BY-NC-SA 4.0.',
      'The software in this repository is licensed under the Apache License, Version 2.0.',
      'Software in this repository is Apache-2.0 licensed; the data are not.',
      'The repository as a whole is therefore not under one licence, and it is not entirely open source.',
      'This repository contains material under different licences.',
      'Portions copied from that repository were distributed there under the MIT License.',
    ];
    for (const sentence of good) expect(CONFLATION.some((re) => re.test(sentence)), sentence).toBe(false);
  });

  it('no document or the rendered notice conflates the licences or says licensing is still unknown', () => {
    const texts: Array<[string, string]> = [
      ...['README.md', 'PROVENANCE.md', 'NOTICE', 'DATA_LICENSE.md'].map((file): [string, string] => [file, doc(file)]),
      ['rendered notice', renderToStaticMarkup(<DataLicensingNotice />).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')],
      ['package.json description', JSON.parse(read('package.json')).description],
    ];
    for (const [name, text] of texts) {
      for (const re of CONFLATION) expect(text, `${name}: ${re}`).not.toMatch(re);
    }
  });
});

describe('map layer attribution', () => {
  const mapFiles = assetManifest.assets.filter((asset) => asset.role === 'map').map((asset) => asset.path.replace(/^map\//, '')).sort();

  it('records a source for each of the twelve shipped map layers, in the notice and in DATA_LICENSE.md', () => {
    expect(mapFiles).toHaveLength(12);
    expect(MAP_LAYER_SOURCES.map((layer) => layer.file).sort()).toEqual(mapFiles);
    const data = doc('DATA_LICENSE.md');
    // The mapping is stated as correspondence, not as verified conversion.
    expect(data).toContain('matched to the FRDR README layer listed below by feature-count and field correspondence');
    expect(data).toContain('not directly byte-compared with the deposited spatial files');
    expect(doc('PROVENANCE.md')).toContain('not directly byte-compared with the deposited spatial files');
    for (const file of ['DATA_LICENSE.md', 'PROVENANCE.md', 'components/DataLicensingNotice.tsx']) {
      expect(doc(file), file).not.toMatch(/converted from|GeoJSON conversions/i);
    }
    for (const layer of MAP_LAYER_SOURCES) {
      expect(layer.source.trim(), layer.file).not.toBe('');
      expect(data, layer.file).toContain(`| \`${layer.file}\` | ${layer.frdrLayer} |`);
    }
  });
});

describe('in-page data and licensing notice', () => {
  const markup = renderToStaticMarkup(<DataLicensingNotice />);

  it('names the citation, the licence and its terms, the changes, and links to the full attribution', () => {
    expect(markup).toContain('>Data and licensing</h2>');
    expect(markup).toContain('aria-labelledby="data-licensing-heading"');
    expect(markup).toContain('Jermilova, U., and Hintelmann, H. (2024)');
    expect(markup).toContain(`href="https://doi.org/${SOURCE_VERSION_DOI}"`);
    expect(markup).toContain(`href="https://doi.org/${CURRENT_VERSION_DOI}"`);
    expect(markup).toContain('href="https://doi.org/10.1093/inteam/vjae011"');
    expect(markup).toContain('href="https://creativecommons.org/licenses/by-nc-sa/4.0/">CC BY-NC-SA 4.0</a>');
    expect(markup).toContain('noncommercial use only');
    expect(markup).toContain('adaptations must be shared under the same licence');
    expect(markup).toContain('Changes: this viewer shows an adapted copy');
    expect(markup).toContain('href="#data-licensing-sources"');
    expect(markup).toContain('id="data-licensing-sources"');
    expect(markup.match(/<li>/g)).toHaveLength(12);
    expect(markup.replace(/\s+/g, ' ')).toContain('matched to the FRDR README layer named below by feature-count and field correspondence');
    expect(markup.replace(/\s+/g, ' ')).toContain('not directly byte-compared with the deposited spatial files');
    expect(markup).not.toMatch(/converted (?:from|to)/i);
    expect(markup).toContain('Apache License 2.0, which does not cover the data');
  });

  it('is rendered by the page, outside the copied viewer shell', () => {
    const client = read('components/JermilovaViewerClient.tsx');
    expect(client).toContain("import { DataLicensingNotice } from './DataLicensingNotice';");
    expect(client).toContain('<DataLicensingNotice />');
  });
});

describe('map providers', () => {
  const siteMap = read('forked/SiteMap.tsx');

  it('uses the canonical OpenStreetMap tile URL with its linked attribution', () => {
    expect(siteMap).toContain("url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'");
    expect(siteMap).toContain('&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors');
    expect(siteMap).not.toContain('{s}.tile.openstreetmap.org');
  });

  it('keeps the OpenTopoMap attribution and credits the BC licence and the pack layers', () => {
    expect(siteMap).toContain('SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)');
    expect(siteMap).toContain('Contains information licensed under the <a href="https://www2.gov.bc.ca/gov/content/data/policy-standards/data-policies/open-data/open-government-licence-bc">Open Government Licence &ndash; British Columbia</a>.');
    expect(siteMap).toContain('attribution: BC_ATTR');
    expect(siteMap).toContain('attribution: PACK_LAYER_ATTR');
    expect(siteMap).toContain('<a href="https://creativecommons.org/licenses/by-nc-sa/4.0/">CC BY-NC-SA 4.0</a>');
  });

  it('the removed Esri and Stamen basemaps do not return anywhere in source, policy or tests', () => {
    expect(MAP_IMAGE_HOSTS).toEqual(['https://tile.openstreetmap.org', 'https://*.tile.opentopomap.org', 'https://openmaps.gov.bc.ca']);
    for (const file of ['forked/SiteMap.tsx', 'scripts/csp.mjs', 'vercel.json', 'e2e/helpers.ts', 'next.config.ts']) {
      const text = read(file).toLowerCase();
      for (const marker of ['stamen-tiles', 'fastly.net', 'tile.stamen', 'arcgisonline', 'world_imagery']) expect(text.includes(marker), `${file} has ${marker}`).toBe(false);
    }
    // The export audit also fails the build if they reach the built site.
    for (const marker of [...RETIRED_HOSTS, ...WRONG_FRDR_DOIS]) expect(FORBIDDEN_MARKERS).toContain(marker);
  });
});
