// Public-asset audit (runs first in `npm run build`).
//
// public/ must hold exactly the one-pack registry and the 19 approved pack files listed in
// asset-manifest.json, each with its recorded byte count and SHA-256. A missing, changed or
// unexpected file (including a stray favicon, image or document) fails the build.
import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(repoRoot, 'public');

// Pinned: asset-manifest.json itself, and the registry bytes (also pinned in lib/verifiedFetch.ts;
// a unit test keeps the two pins equal).
export const ASSET_MANIFEST_SHA256 = '135e6bafc3c8aaf0907b5c41e32a6801ed6338790233c6db822981a2f2c5c526';
export const REGISTRY_SHA256 = 'a62993279e1872909d67831bce1dc3d4965479bc3d23ae58898b73b0b4e03454';
export const PACK_ID = 'bnrrm-casestudy-jermilova2025-mackenzie-hg';
// Pinned: claim-register.json, which binds displayed pack values to the data files. The
// runtime loader checks only the rows that are present, so removing a row would weaken that
// check silently; pinning the whole file makes any change to the register deliberate.
export const CLAIM_REGISTER_SHA256 = '15d605261f2ac36450907dff661af68348c7073c240234018f83b0218b3bb603';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function loadManifest() {
  const bytes = await readFile(path.join(repoRoot, 'asset-manifest.json'));
  if (sha256(bytes) !== ASSET_MANIFEST_SHA256) throw new Error('asset-manifest.json does not match its pinned SHA-256.');
  const manifest = JSON.parse(bytes.toString('utf8'));
  if (manifest.pack_id !== PACK_ID || !Array.isArray(manifest.assets) || manifest.assets.length !== 19) {
    throw new Error('asset-manifest.json has an unexpected pack id or asset count.');
  }
  for (const asset of manifest.assets) {
    if (typeof asset.path !== 'string' || asset.path.startsWith('/') || asset.path.includes('\\')
      || asset.path.split('/').some((part) => part === '' || part === '.' || part === '..')) {
      throw new Error(`Unsafe asset path in manifest: ${asset.path}`);
    }
  }
  return manifest;
}

const manifest = await loadManifest();

export function expectedPublicFiles() {
  return ['bn-rrm/pack-registry.json', ...manifest.assets.map((asset) => `bn-rrm/packs/${PACK_ID}/${asset.path}`)].sort();
}

export async function listPublicFiles(root = publicRoot, prefix = '') {
  const found = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const info = await lstat(full);
    if (info.isSymbolicLink()) throw new Error(`Symlink in public/: ${relative}`);
    if (info.isDirectory()) found.push(...(await listPublicFiles(full, relative)));
    else if (info.isFile()) found.push(relative);
    else throw new Error(`Unsupported entry in public/: ${relative}`);
  }
  return found.sort();
}

export async function checkAssets() {
  const problems = [];
  const actual = await listPublicFiles();
  const expected = expectedPublicFiles();
  for (const file of expected) if (!actual.includes(file)) problems.push(`missing public/${file}`);
  for (const file of actual) if (!expected.includes(file)) problems.push(`unexpected public/${file}`);

  const claimRegisterBytes = await readFile(path.join(repoRoot, 'claim-register.json')).catch(() => null);
  if (!claimRegisterBytes || sha256(claimRegisterBytes) !== CLAIM_REGISTER_SHA256) {
    problems.push('claim-register.json is missing or does not match its pinned SHA-256');
  }

  const registryBytes = await readFile(path.join(publicRoot, 'bn-rrm', 'pack-registry.json')).catch(() => null);
  if (registryBytes) {
    if (sha256(registryBytes) !== REGISTRY_SHA256) problems.push('pack-registry.json does not match its pinned SHA-256');
    const registry = JSON.parse(registryBytes.toString('utf8'));
    const ids = (registry.packs ?? []).map((pack) => pack.pack_id);
    if (registry.default_pack_id !== PACK_ID || ids.length !== 1 || ids[0] !== PACK_ID) problems.push('registry must offer exactly the Jermilova pack');
  }
  for (const asset of manifest.assets) {
    const bytes = await readFile(path.join(publicRoot, 'bn-rrm', 'packs', PACK_ID, ...asset.path.split('/'))).catch(() => null);
    if (!bytes) continue; // reported as missing above
    if (bytes.length !== asset.bytes || sha256(bytes) !== asset.sha256) problems.push(`changed public/bn-rrm/packs/${PACK_ID}/${asset.path}`);
  }
  return { status: problems.length ? 'FAIL' : 'PASS', files: actual.length, problems };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const result = await checkAssets();
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'PASS') process.exitCode = 1;
}
