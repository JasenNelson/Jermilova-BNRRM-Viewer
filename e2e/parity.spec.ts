// Rendered parity: this standalone build vs the published reference viewer, both loaded
// anonymously and read-only (GET requests only, no credentials, no sign-in).
//   parity-standalone (@standalone) -> parity-reference (@reference) -> compare (@compare)
// Run with `npm run test:parity` after `npm run build`. Evidence (snapshots, screenshots) is
// written to EVIDENCE_DIR (default .evidence/, gitignored).
import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import {
  NO_WRITES,
  TABS,
  installWriteSpies,
  mainArea,
  nodeCountStatus,
  openTab,
  settledCanvasState,
  tabLabels,
  watchProblems,
  wrapper,
  writeCounts,
} from './helpers';

const EVIDENCE = process.env.EVIDENCE_DIR as string;
// Mount path of the reference viewer on its host (the standalone build is served from '/').
export const REFERENCE_MOUNT = '/Jermilova';
const WIDTHS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'phone', width: 390, height: 844 },
];

interface Snapshot {
  tabs: string[];
  chrome: string;
  canvas: Record<string, { containers: number; children: number; edges: string[] }>;
  text: Record<string, string>;
}

// Header + PackBanner + any error banner (everything outside <main>), minus the tab nav.
async function chromeText(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector('.bn-rrm-wrapper');
    if (!root) return '';
    const parts: string[] = [];
    for (const child of Array.from(root.children)) {
      if (child.tagName === 'MAIN') continue;
      const clone = child.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('nav').forEach((nav) => nav.remove());
      parts.push((clone.textContent ?? '').replace(/\s+/g, ' ').trim());
    }
    return parts.filter(Boolean).join('\n');
  });
}

async function snapshot(page: Page, label: string): Promise<Snapshot> {
  const snap: Snapshot = { tabs: await tabLabels(page), chrome: '', canvas: {}, text: {} };
  await openTab(page, 'Detailed BN');
  await page.locator('.react-flow__node-containerNode').first().waitFor();
  snap.chrome = await chromeText(page);
  snap.canvas.collapsed = await settledCanvasState(page);
  await page.locator('[data-id="container_4"]').click();
  snap.canvas.mixed = await settledCanvasState(page);
  await page.getByTitle('Expand all containers').click();
  snap.canvas.expanded = await settledCanvasState(page);
  await page.locator('[data-id="fish_tissue_hg"]').click();
  await page.waitForTimeout(300);
  snap.text['inspector-desktop'] = await mainArea(page).innerText();
  await page.getByTitle('Collapse all containers').click();
  for (const size of WIDTHS) {
    await page.setViewportSize({ width: size.width, height: size.height });
    for (const tab of TABS) {
      await openTab(page, tab);
      if (tab === 'Map' && size.name === 'desktop') await expect(page.locator('.leaflet-container').first()).toBeVisible();
      snap.text[`${tab}-${size.name}`] = await mainArea(page).innerText();
      await page.screenshot({ path: path.join(EVIDENCE, `${label}-${tab.replace(/\W+/g, '_')}-${size.name}.png`), fullPage: true });
    }
  }
  fs.writeFileSync(path.join(EVIDENCE, `${label}-snapshot.json`), JSON.stringify(snap, null, 2));
  return snap;
}

async function run(page: Page, label: string, entry: string, viewerPaths: RegExp[], origin: string) {
  await installWriteSpies(page);
  const problems = watchProblems(page, origin, viewerPaths);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(entry);
  await expect(wrapper(page).locator('nav button')).toHaveCount(6, { timeout: 60_000 });
  await expect(nodeCountStatus(page)).toHaveText('14 nodes', { timeout: 60_000 });
  const snap = await snapshot(page, label);
  const writes = await writeCounts(page);
  fs.writeFileSync(path.join(EVIDENCE, `${label}-problems.json`), JSON.stringify({ problems, writes }, null, 2));
  return { snap, problems, writes };
}

test('@standalone standalone build, anonymous', async ({ page, baseURL }) => {
  const origin = new URL(baseURL as string).origin;
  const { problems, writes } = await run(page, 'standalone', '/', [/^\/$/, /^\/index\.txt$/, /^\/_next\//, /^\/bn-rrm\//, /^\/favicon\.ico$/], origin);
  expect(writes).toEqual(NO_WRITES);
  expect(problems).toEqual([]);
});

test('@reference published reference viewer, anonymous and read-only', async ({ page, baseURL }) => {
  const origin = new URL(baseURL as string).origin;
  const mount = REFERENCE_MOUNT.replace(/[/]/g, '\\/');
  const paths = [new RegExp(`^${mount}\\/?$`), new RegExp(`^${mount}\\/index\\.txt$`), new RegExp(`^${mount}\\/_next\\/`), new RegExp(`^${mount}\\/bn-rrm\\/`), /^\/favicon\.ico$/];
  const { writes } = await run(page, 'reference', REFERENCE_MOUNT, paths, origin);
  // The reference is observed, not judged: its write counts are recorded as evidence.
  expect(writes.installed).toEqual(NO_WRITES.installed);
});

test('@compare standalone equals the reference viewer', async () => {
  const read = (label: string) => JSON.parse(fs.readFileSync(path.join(EVIDENCE, `${label}-snapshot.json`), 'utf8')) as Snapshot;
  const standalone = read('standalone');
  const reference = read('reference');
  const normalize = (text: string) => text.split('\n').map((line) => line.trim()).filter(Boolean).join('\n');
  expect(standalone.tabs).toEqual(TABS);
  expect(standalone.tabs).toEqual(reference.tabs);
  expect(standalone.chrome).toContain('Frozen benchmark');
  expect(standalone.chrome).toEqual(reference.chrome);
  expect(standalone.canvas).toEqual(reference.canvas);
  const diffs: string[] = [];
  for (const key of Object.keys(reference.text)) {
    if (normalize(standalone.text[key] ?? '') !== normalize(reference.text[key])) diffs.push(key);
  }
  fs.writeFileSync(path.join(EVIDENCE, 'compare-result.json'), JSON.stringify({ diffs, keys: Object.keys(reference.text) }, null, 2));
  expect(diffs).toEqual([]);
});
