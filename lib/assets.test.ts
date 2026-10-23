import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import assetManifest from '../asset-manifest.json';
import { JERMILOVA_VIEWER_CAPABILITIES } from '../viewer-capabilities';
import { CLAIM_REGISTER_SHA256, checkAssets, expectedPublicFiles, listPublicFiles } from '../scripts/check-assets.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packRoot = path.join(repoRoot, 'public', 'bn-rrm', 'packs', assetManifest.pack_id);

describe('viewer asset manifest', () => {
  it('keeps the asset check, runtime pack check, CSP step and export audit in the one build path', async () => {
    const packageJson = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8'));
    expect(packageJson.scripts.build).toBe(
      'node scripts/check-assets.mjs && vitest run lib/loadJermilovaPack.test.ts && next build && node scripts/csp.mjs --write && node scripts/audit-export.mjs',
    );
  });

  it('contains exactly the retained-view fetch closure: six core, one review and twelve map assets', () => {
    expect(assetManifest.assets).toHaveLength(19);
    expect(assetManifest.assets.map((asset) => asset.key).sort()).toEqual(
      [...JERMILOVA_VIEWER_CAPABILITIES.assetKeys].sort(),
    );
    expect(assetManifest.assets.filter((asset) => asset.role === 'core')).toHaveLength(6);
    expect(assetManifest.assets.filter((asset) => asset.role === 'review').map((asset) => asset.key)).toEqual(['site_reports']);
    expect(assetManifest.assets.filter((asset) => asset.role === 'map')).toHaveLength(12);
  });

  it('matches every shipped pack file by exact byte count and SHA-256', async () => {
    for (const asset of assetManifest.assets) {
      const bytes = await readFile(path.join(packRoot, ...asset.path.split('/')));
      expect(bytes.byteLength, asset.path).toBe(asset.bytes);
      expect(createHash('sha256').update(bytes).digest('hex'), asset.path).toBe(asset.sha256);
    }
  });

  it('pins the complete claim register: all 14 frozen claim rows, including omitted ones', async () => {
    const bytes = await readFile(path.join(repoRoot, 'claim-register.json'));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(CLAIM_REGISTER_SHA256);
    const register = JSON.parse(bytes.toString('utf8')) as { claims: Array<{ id: string }> };
    expect(register.claims.map((claim) => claim.id)).toEqual([
      'pack-display-name', 'pack-release-stage', 'article-citation', 'article-doi',
      'model-node-count', 'model-edge-count', 'applicability-boundaries',
      'gsl-training-name', 'gsl-training-fish', 'gsl-training-water',
      'gbs-training-name', 'gbs-training-fish', 'gbs-training-water', 'dataset-repository-doi',
    ]);
    expect((await checkAssets()).status).toBe('PASS');
  });

  it('ships no public file beyond the registry and the 19 approved pack files', async () => {
    expect(await listPublicFiles()).toEqual(expectedPublicFiles());
  });
});
