import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// Browser suites. Both need a finished build in out/ (`npm run build`).
//   npm run test:e2e     the standalone viewer at desktop and phone widths (CI runs this)
//   npm run test:parity  standalone vs the published reference viewer (network; manual)
// The local preview server serves out/ from '/' with the vercel.json headers.
// No credentials, cookies or sign-in are used anywhere.
const PORT = Number(process.env.VIEWER_PORT ?? 4173);
const LOCAL_URL = `http://127.0.0.1:${PORT}`;
// Origin of the published reference viewer (served there at /Jermilova); override with
// REFERENCE_ORIGIN to compare against another copy.
const REFERENCE_ORIGIN = process.env.REFERENCE_ORIGIN ?? 'https://sstac-dashboard.vercel.app';
const EVIDENCE_DIR = path.resolve(process.env.EVIDENCE_DIR ?? path.join(__dirname, '.evidence'));
process.env.EVIDENCE_DIR = EVIDENCE_DIR;
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

const anonymous = { storageState: { cookies: [], origins: [] } };

export default defineConfig({
  testDir: './e2e',
  outputDir: path.join(EVIDENCE_DIR, 'test-output'),
  globalTimeout: 1_200_000,
  timeout: 180_000,
  expect: { timeout: 30_000 },
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  reporter: [['list']],
  use: { trace: 'off', screenshot: 'off', video: 'off' },
  webServer: {
    command: `node scripts/preview-server.js out ${PORT}`,
    url: `${LOCAL_URL}/`,
    reuseExistingServer: false,
    timeout: 30_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
  projects: [
    {
      name: 'viewer-desktop',
      testMatch: /viewer\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], ...anonymous, baseURL: LOCAL_URL, viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'viewer-phone',
      testMatch: /viewer\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], ...anonymous, baseURL: LOCAL_URL, viewport: { width: 390, height: 844 } },
    },
    {
      name: 'parity-standalone',
      testMatch: /parity\.spec\.ts/,
      grep: /@standalone/,
      use: { ...devices['Desktop Chrome'], ...anonymous, baseURL: LOCAL_URL },
    },
    {
      name: 'parity-reference',
      testMatch: /parity\.spec\.ts/,
      grep: /@reference/,
      use: { ...devices['Desktop Chrome'], ...anonymous, baseURL: REFERENCE_ORIGIN },
    },
    {
      name: 'compare',
      testMatch: /parity\.spec\.ts/,
      grep: /@compare/,
      dependencies: ['parity-standalone', 'parity-reference'],
    },
  ],
});
