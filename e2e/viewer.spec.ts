// The standalone viewer, served from '/' by scripts/preview-server.js with the vercel.json
// headers. Runs in the viewer-desktop (1440 x 900) and viewer-phone (390 x 844) projects.
import { expect, test } from '@playwright/test';
import {
  EMPTY_STATE,
  NO_WRITES,
  TABS,
  installWriteSpies,
  mainArea,
  nodeCountStatus,
  openTab,
  settledCanvasState,
  storedState,
  tabLabels,
  watchProblems,
  wrapper,
  writeCounts,
} from './helpers';

const VIEWER_PATHS = [/^\/$/, /^\/index\.txt$/, /^\/_next\//, /^\/bn-rrm\//, /^\/favicon\.ico$/];

test('read-only viewer: headers, six tabs, Detailed BN states, in-memory what-if, no writes', async ({ page, baseURL, context }, testInfo) => {
  const phone = testInfo.project.name === 'viewer-phone';
  const origin = new URL(baseURL as string).origin;
  await installWriteSpies(page);
  const problems = watchProblems(page, origin, VIEWER_PATHS);

  // Served from the root with the static-site security headers.
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  expect(new URL(page.url()).pathname).toBe('/');
  const headers = response?.headers() ?? {};
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-robots-tag']).toBe('noindex, nofollow');
  expect(headers['cache-control']).toBe('no-cache');
  // The build-derived script policy is in the page, ahead of every script.
  const metaPolicy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(metaPolicy).toMatch(/script-src 'self'( 'sha256-[A-Za-z0-9+/=]+')+;/);
  expect(metaPolicy?.split(';').find((d) => d.trim().startsWith('script-src'))).not.toContain('unsafe');
  expect(await page.locator('meta[name="robots"]').getAttribute('content')).toBe('noindex, nofollow');

  // Six tabs in source order, the 14-node Jermilova model, no pack selector.
  await expect(wrapper(page).locator('nav button')).toHaveCount(6, { timeout: 60_000 });
  await expect(nodeCountStatus(page)).toHaveText('14 nodes', { timeout: 60_000 });
  if (!phone) expect(await tabLabels(page)).toEqual(TABS);
  await expect(wrapper(page).locator('> div').first().locator('svg.lucide-chevron-down')).toHaveCount(0);
  await expect(page.getByText('Frozen benchmark', { exact: false }).first()).toBeAttached();

  // Detailed BN: collapsed -> one group expanded -> fully expanded. At phone width the
  // original layout keeps both side panels open; hide them so the canvas has room.
  await openTab(page, 'Detailed BN');
  if (phone) {
    await page.getByRole('button', { name: 'Hide left panel' }).click();
    await page.getByRole('button', { name: 'Hide right panel' }).click();
  }
  await page.locator('.react-flow__node-containerNode').first().waitFor();
  const collapsed = await settledCanvasState(page);
  expect(collapsed).toMatchObject({ containers: 7, children: 0 });
  expect(collapsed.edges).toHaveLength(6);
  await page.locator('[data-id="container_4"]').click();
  expect(await settledCanvasState(page)).toMatchObject({ containers: 7, children: 2 });
  // At 390 px the original canvas layout places the pack-title panel over the canvas
  // controls (inherited unchanged; see README "Known layout facts"), so the phone run
  // triggers the control directly instead of tapping through the overlap.
  const expandAll = page.getByTitle('Expand all containers');
  if (phone) await expandAll.dispatchEvent('click');
  else await expandAll.click();
  const expanded = await settledCanvasState(page);
  expect(expanded).toMatchObject({ containers: 7, children: 14 });
  // The original node component for MeHg Ingested has no source handle, so React Flow draws
  // 14 of the model's 15 edges (same as the original page; the model still uses all 15).
  expect(expanded.edges).toHaveLength(14);

  // In-memory what-if: set evidence on a root node, see it applied, reset it.
  if (phone) {
    await page.getByRole('button', { name: 'Show left panel' }).click();
    await page.getByRole('button', { name: 'Show right panel' }).click();
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  await page.locator('[data-id="fish_length"]').click();
  const inspector = mainArea(page);
  await expect(inspector.getByText('Click a state to set as evidence')).toBeVisible();
  await inspector.getByText('Click a state to set as evidence').locator('xpath=..').locator('[role="button"]').last().click();
  await expect(inspector.getByText(/Evidence set/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(inspector.getByText('Posterior probability given all set evidence')).toBeVisible();
  if (phone) await page.setViewportSize({ width: 390, height: 844 });

  // Every tab renders its own content.
  for (const tab of TABS) {
    await openTab(page, tab);
    await page.screenshot({ path: testInfo.outputPath(`${tab.replace(/\W+/g, '_')}.png`), fullPage: true });
  }

  // Nothing was written anywhere, and nothing is stored.
  expect(await writeCounts(page)).toEqual(NO_WRITES);
  expect(await storedState(page)).toEqual(EMPTY_STATE);
  expect(await context.cookies(origin)).toEqual([]);

  // A reload restores the initial (all collapsed, no evidence) state: nothing persisted.
  await openTab(page, 'Detailed BN');
  if (phone) await page.getByTitle('Expand all containers').dispatchEvent('click');
  else await page.getByTitle('Expand all containers').click();
  await page.reload();
  await expect(nodeCountStatus(page)).toHaveText('14 nodes', { timeout: 60_000 });
  await page.locator('.react-flow__node-containerNode').first().waitFor();
  expect((await settledCanvasState(page)).children).toBe(0);
  expect(await writeCounts(page)).toEqual(NO_WRITES);
  expect(await storedState(page)).toEqual(EMPTY_STATE);
  expect(problems).toEqual([]);
});

test('serves only the viewer files: unknown paths get the static 404 page', async ({ request }) => {
  for (const path of ['/Jermilova', '/api/bn-rrm/wms-identify', '/login', '/bn-rrm', '/favicon.ico']) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(404);
  }
  const registry = await request.get('/bn-rrm/pack-registry.json');
  expect(registry.status()).toBe(200);
  expect(registry.headers()['cache-control']).toBe('no-store');
});
