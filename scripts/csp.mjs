// Content Security Policy for the static export.
//
// Next's static export bootstraps each page with small inline scripts whose text names the
// build's chunk files, so their SHA-256 hashes change whenever the code, the dependencies or
// the build environment change. Instead of a hand-maintained hash list, this step reads the
// exact exported HTML after `next build`, hashes every inline script, and writes the policy
// into each page as a <meta http-equiv="Content-Security-Policy"> tag placed before any
// script or stylesheet. The hashes therefore always match the bytes that are deployed,
// whether the build runs locally, in CI or on Vercel.
//
// Directives a <meta> policy cannot carry (frame-ancestors) and every directive that does not
// depend on the build are also sent as a response header from vercel.json. The browser
// enforces both policies. `node scripts/csp.mjs --check` (part of `npm run audit`) proves:
//   - every exported HTML page has exactly one CSP meta tag, ahead of every script and link;
//   - its script-src lists exactly the SHA-256 of each inline script on that page, no more;
//   - no page has inline event-handler attributes or javascript: URLs;
//   - vercel.json carries exactly the headers defined in this file.
//
// Usage: node scripts/csp.mjs --write   (after next build; refuses to run twice on one export)
//        node scripts/csp.mjs --check
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exportRoot = path.join(repoRoot, 'out');

// Hosts the map loads tiles and overlay images from (the OpenStreetMap and OpenTopoMap
// basemaps and the BC government WMS; see DATA_LICENSE.md). Map tiles are images; the viewer
// makes no other cross-origin request.
export const MAP_IMAGE_HOSTS = [
  'https://tile.openstreetmap.org',
  'https://*.tile.opentopomap.org',
  'https://openmaps.gov.bc.ca',
];

// Directives that do not depend on the build. Sent in the response header and repeated in
// the meta policy.
export const STATIC_DIRECTIVES = [
  // Tailwind and Leaflet set inline styles.
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${MAP_IMAGE_HOSTS.join(' ')}`,
  "font-src 'self' data:",
  "connect-src 'self' https://openmaps.gov.bc.ca",
  "object-src 'none'",
  // No web workers or service workers (and so no service-worker caches).
  "worker-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
];

export const HEADER_CSP = [...STATIC_DIRECTIVES, "frame-ancestors 'none'"].join('; ');

export function metaCsp(scriptHashes) {
  const hashes = scriptHashes.map((hash) => `'${hash}'`).join(' ');
  return ["default-src 'self'", `script-src 'self'${hashes ? ` ${hashes}` : ''}`, ...STATIC_DIRECTIVES].join('; ');
}

// The exact vercel.json this repository must carry.
export function expectedVercelConfig() {
  return {
    $schema: 'https://openapi.vercel.sh/vercel.json',
    framework: 'nextjs',
    installCommand: 'npm ci',
    buildCommand: 'npm run build',
    headers: [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: HEADER_CSP },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
          },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
          // Public but not indexed by search engines (the pack data include claim-owner and
          // company names). Removing this is a deliberate decision, not a default.
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      // The page is revalidated on every load, so a fresh load gets the current page with
      // the current pack files.
      { source: '/', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
      // Pack files have stable, unhashed URLs; never reuse old bytes after an update (the
      // integrity check would otherwise show the error page until the cache expired).
      { source: '/bn-rrm/(.*)', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ],
  };
}

const sha256Base64 = (text) => `sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}`;
const META_PATTERN = /<meta http-equiv="Content-Security-Policy" content="([^"]*)"\/?>/gi;
const SCRIPT_PATTERN = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

export function inlineScriptHashes(html) {
  const hashes = [];
  for (const match of html.matchAll(SCRIPT_PATTERN)) {
    if (/\bsrc\s*=/i.test(match[1])) {
      if (match[2].trim() !== '') throw new Error('A script with src also has inline text.');
      continue;
    }
    hashes.push(sha256Base64(match[2]));
  }
  return [...new Set(hashes)];
}

const escapeAttribute = (value) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
const unescapeAttribute = (value) => value.replaceAll('&quot;', '"').replaceAll('&amp;', '&');

export function injectCsp(html) {
  if (html.match(META_PATTERN)) throw new Error('Page already has a CSP meta tag.');
  const anchor = '<meta charSet="utf-8"/>';
  const index = html.indexOf(anchor);
  if (index < 0) throw new Error(`Page has no ${anchor} to place the CSP after.`);
  const meta = `<meta http-equiv="Content-Security-Policy" content="${escapeAttribute(metaCsp(inlineScriptHashes(html)))}"/>`;
  return html.slice(0, index + anchor.length) + meta + html.slice(index + anchor.length);
}

export function checkPage(html) {
  const problems = [];
  const metas = [...html.matchAll(META_PATTERN)];
  if (metas.length !== 1) return [`expected exactly one CSP meta tag, found ${metas.length}`];
  const meta = metas[0];
  const firstResource = html.search(/<script\b|<link\b|<style\b/i);
  if (firstResource >= 0 && meta.index > firstResource) problems.push('CSP meta tag comes after a script, link or style');
  const expected = metaCsp(inlineScriptHashes(html));
  if (unescapeAttribute(meta[1]) !== expected) problems.push('CSP meta policy does not equal the policy derived from this page');
  const markup = html.replace(SCRIPT_PATTERN, '<script></script>');
  if (/<[a-z][^>]*\son[a-z]+\s*=/i.test(markup)) problems.push('inline event-handler attribute');
  if (/<[a-z][^>]*=\s*["']?\s*javascript:/i.test(markup)) problems.push('javascript: URL');
  return problems;
}

async function htmlFiles(root, prefix = '') {
  const found = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) found.push(...(await htmlFiles(path.join(root, entry.name), relative)));
    else if (entry.name.endsWith('.html')) found.push(relative);
  }
  return found.sort();
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export async function checkExport() {
  const problems = [];
  const pages = await htmlFiles(exportRoot);
  if (!pages.includes('index.html')) problems.push('out/index.html is missing');
  const report = {};
  for (const page of pages) {
    const html = await readFile(path.join(exportRoot, page), 'utf8');
    const pageProblems = checkPage(html);
    report[page] = { inline_scripts: inlineScriptHashes(html).length, problems: pageProblems };
    problems.push(...pageProblems.map((problem) => `${page}: ${problem}`));
  }
  const vercel = JSON.parse(await readFile(path.join(repoRoot, 'vercel.json'), 'utf8'));
  if (!sameJson(vercel, expectedVercelConfig())) problems.push('vercel.json differs from expectedVercelConfig() in scripts/csp.mjs');
  return { status: problems.length ? 'FAIL' : 'PASS', pages: report, problems };
}

async function writeExport() {
  const pages = await htmlFiles(exportRoot);
  if (!pages.length) throw new Error('No exported HTML found; run next build first.');
  for (const page of pages) {
    const file = path.join(exportRoot, page);
    await writeFile(file, injectCsp(await readFile(file, 'utf8')), 'utf8');
  }
  return pages;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const mode = process.argv[2];
  if (mode === '--write') {
    const pages = await writeExport();
    const result = await checkExport();
    console.log(JSON.stringify({ step: 'csp --write', written: pages, ...result }, null, 2));
    if (result.status !== 'PASS') process.exitCode = 1;
  } else if (mode === '--check') {
    const result = await checkExport();
    console.log(JSON.stringify({ step: 'csp --check', ...result }, null, 2));
    if (result.status !== 'PASS') process.exitCode = 1;
  } else {
    console.error('Usage: node scripts/csp.mjs --write | --check');
    process.exitCode = 2;
  }
}
