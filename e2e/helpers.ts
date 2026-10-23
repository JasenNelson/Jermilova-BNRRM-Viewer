// Shared helpers for the viewer and parity suites.
import { expect, type Page } from '@playwright/test';

export const TABS = ['Guide', 'Conceptual', 'Detailed BN', 'CPT', 'Map', 'Data'];

// Hosts the map loads tiles from (OpenStreetMap and OpenTopoMap basemaps and the BC
// government WMS).
export const APPROVED_HOSTS = [
  /^tile\.openstreetmap\.org$/,
  /(^|\.)tile\.opentopomap\.org$/,
  /^openmaps\.gov\.bc\.ca$/,
];

// next/dynamic placeholders (verbatim from the original shell): capture only once a tab's
// own content is rendered, never on a fixed delay.
export const LOADING = /Loading (canvas|map|CPT explorer|guide|training data)\.\.\./;

export const wrapper = (page: Page) => page.locator('.bn-rrm-wrapper');
export const mainArea = (page: Page) => page.locator('.bn-rrm-wrapper > main');
// The shell's node-count status in its sub-header (the results badge also says "14 nodes").
export const nodeCountStatus = (page: Page) => wrapper(page).locator('> div').first().getByText(/^\d+ nodes$/);

export const READY: Record<string, (page: Page) => Promise<unknown>> = {
  Guide: (page) => mainArea(page).locator('h2').first().waitFor(),
  Conceptual: (page) => mainArea(page).locator('h2').first().waitFor(),
  'Detailed BN': (page) => page.locator('.react-flow__node').first().waitFor(),
  CPT: (page) => mainArea(page).getByText(/With CPT/).first().waitFor(),
  // Attached, not visible: at phone width the original layout keeps both side panels open,
  // which leaves the map 0 px wide until a panel is hidden.
  Map: (page) => page.locator('.leaflet-container').first().waitFor({ state: 'attached' }),
  Data: (page) => page.getByPlaceholder('Filter values...').waitFor(),
};

export async function tabLabels(page: Page) {
  return (await wrapper(page).locator('nav button').allInnerTexts()).map((t) => t.trim());
}

export async function openTab(page: Page, label: string) {
  // At narrow widths the tab buttons show icons only; their title is the tab description,
  // so select by position in the source order.
  await wrapper(page).locator('nav button').nth(TABS.indexOf(label)).click();
  await READY[label](page);
  await expect(mainArea(page)).not.toContainText(LOADING);
  await page.waitForTimeout(300);
}

export async function canvasState(page: Page) {
  const nodes = page.locator('.react-flow__node');
  const containers = await page.locator('.react-flow__node-containerNode').count();
  const edges = await page.locator('[data-testid^="rf__edge-"]').evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-testid') ?? '').sort(),
  );
  return { containers, children: (await nodes.count()) - containers, edges };
}

// React Flow renders nodes and edges only after measuring them: read until three
// consecutive samples, 250 ms apart, agree.
export async function settledCanvasState(page: Page) {
  const samples: string[] = [];
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const state = await canvasState(page);
    samples.push(JSON.stringify(state));
    if (samples.length >= 3 && samples.slice(-3).every((sample) => sample === samples[samples.length - 1])) return state;
    await page.waitForTimeout(250);
  }
  throw new Error(`Canvas did not settle: ${samples.slice(-3).join(' | ')}`);
}

// Counts every browser-storage, IndexedDB, cookie, Cache Storage and service-worker write
// from the first script on (a write that is later undone still counts), plus every CSP
// violation event. Each spy records that it installed, so a zero is never vacuous.
export async function installWriteSpies(page: Page) {
  await page.addInitScript(() => {
    const counts = { storage: 0, indexedDB: 0, cookie: 0, cacheStorage: 0, serviceWorker: 0 };
    const installed = { storage: false, indexedDB: false, cookie: false, cacheStorage: false, serviceWorker: false };
    const violations: string[] = [];
    const view = window as unknown as Record<string, unknown>;
    view.__writes = counts;
    view.__spiesInstalled = installed;
    view.__cspViolations = violations;
    document.addEventListener('securitypolicyviolation', (event) => {
      violations.push(`${event.violatedDirective} ${event.blockedURI}`);
    });
    for (const name of ['setItem', 'removeItem', 'clear'] as const) {
      const original = Storage.prototype[name] as (...args: unknown[]) => unknown;
      (Storage.prototype as unknown as Record<string, unknown>)[name] = function (this: Storage, ...args: unknown[]) {
        counts.storage += 1;
        return original.apply(this, args);
      };
    }
    installed.storage = true;
    const factory = window.indexedDB;
    if (factory) {
      const open = factory.open.bind(factory);
      const remove = factory.deleteDatabase.bind(factory);
      factory.open = ((...args: Parameters<IDBFactory['open']>) => { counts.indexedDB += 1; return open(...args); }) as IDBFactory['open'];
      factory.deleteDatabase = ((...args: Parameters<IDBFactory['deleteDatabase']>) => { counts.indexedDB += 1; return remove(...args); }) as IDBFactory['deleteDatabase'];
      installed.indexedDB = true;
    }
    const cookie = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    if (cookie && cookie.get && cookie.set) {
      const setCookie = cookie.set;
      Object.defineProperty(Document.prototype, 'cookie', {
        configurable: true,
        get: cookie.get,
        set(this: Document, value: string) { counts.cookie += 1; setCookie.call(this, value); },
      });
      installed.cookie = true;
    }
    const cookieStore = (window as unknown as { cookieStore?: { set: (...a: unknown[]) => unknown; delete: (...a: unknown[]) => unknown } }).cookieStore;
    if (cookieStore) {
      const set = cookieStore.set.bind(cookieStore);
      const del = cookieStore.delete.bind(cookieStore);
      cookieStore.set = (...args: unknown[]) => { counts.cookie += 1; return set(...args); };
      cookieStore.delete = (...args: unknown[]) => { counts.cookie += 1; return del(...args); };
    }
    if (window.caches) {
      const cacheStorage = window.caches;
      const open = cacheStorage.open.bind(cacheStorage);
      const del = cacheStorage.delete.bind(cacheStorage);
      cacheStorage.open = (...args: Parameters<CacheStorage['open']>) => { counts.cacheStorage += 1; return open(...args); };
      cacheStorage.delete = (...args: Parameters<CacheStorage['delete']>) => { counts.cacheStorage += 1; return del(...args); };
      installed.cacheStorage = true;
    }
    if (navigator.serviceWorker) {
      const container = navigator.serviceWorker;
      const register = container.register.bind(container);
      container.register = (...args: Parameters<ServiceWorkerContainer['register']>) => { counts.serviceWorker += 1; return register(...args); };
      installed.serviceWorker = true;
    }
  });
}

export const NO_WRITES = {
  writes: { storage: 0, indexedDB: 0, cookie: 0, cacheStorage: 0, serviceWorker: 0 },
  installed: { storage: true, indexedDB: true, cookie: true, cacheStorage: true, serviceWorker: true },
  cspViolations: [] as string[],
};

export const writeCounts = (page: Page) =>
  page.evaluate(() => {
    const view = window as unknown as Record<string, unknown>;
    return { writes: view.__writes, installed: view.__spiesInstalled, cspViolations: view.__cspViolations };
  });

// Final browser state: nothing stored anywhere.
export const storedState = (page: Page) =>
  page.evaluate(async () => ({
    local: localStorage.length,
    session: sessionStorage.length,
    indexedDB: typeof indexedDB.databases === 'function' ? (await indexedDB.databases()).length : 0,
    cacheStorage: window.caches ? (await caches.keys()).length : 0,
    serviceWorkers: navigator.serviceWorker ? (await navigator.serviceWorker.getRegistrations()).length : 0,
  }));

export const EMPTY_STATE = { local: 0, session: 0, indexedDB: 0, cacheStorage: 0, serviceWorkers: 0 };

// Records page errors, same-origin console errors, non-GET requests, same-origin requests
// outside the viewer's own files, and cross-origin requests to unapproved hosts.
export function watchProblems(page: Page, origin: string, viewerPaths: RegExp[]) {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const location = message.location().url;
    const host = location ? new URL(location).hostname : '';
    if (!APPROVED_HOSTS.some((re) => re.test(host))) problems.push(`console: ${message.text()}`);
  });
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (request.method() !== 'GET') problems.push(`non-GET ${request.method()} ${url.href}`);
    if (url.protocol === 'data:' || url.protocol === 'blob:') return;
    if (url.origin === origin) {
      if (!viewerPaths.some((re) => re.test(url.pathname))) problems.push(`unexpected path ${url.pathname}`);
    } else if (!APPROVED_HOSTS.some((re) => re.test(url.hostname))) {
      problems.push(`unapproved host ${url.hostname}`);
    }
  });
  return problems;
}
