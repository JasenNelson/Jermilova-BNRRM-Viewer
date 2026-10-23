// FRDR dataset identifier correction for the data pack (one-time, reproducible, checkable).
//
// The pack copied from the source viewer cited the deposited dataset with identifiers that
// are not this dataset's: one belongs to an unrelated FRDR dataset and the other does not
// resolve. The article (doi:10.1093/inteam/vjae011) cites FRDR doi:10.20383/103.0957 in its
// data-availability statement, so the pack now cites that source version. The current FRDR
// version (doi:10.20383/103.01279) is recorded in DATA_LICENSE.md only: the pack bytes were
// not refreshed from it.
//
// This script changes nothing but those identifier strings. It never rewrites any other byte
// of a pack file; it then recomputes the integrity records that hash those files.
//
//   node scripts/correct-frdr-doi.mjs --check   verify the corrected state (no writes)
//   node scripts/correct-frdr-doi.mjs --write   apply the correction to the source bytes
//
// The wrong identifiers are assembled from parts so that the repository-wide check in
// lib/licensing.test.tsx can forbid the literal strings in every file, this one included.
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FRDR_PREFIX = ['10', '20383/103'].join('.') + '.';
export const WRONG_FRDR_DOIS = [FRDR_PREFIX + '0945', FRDR_PREFIX + '0943'];
export const SOURCE_VERSION_DOI = '10.20383/103.0957';
export const CURRENT_VERSION_DOI = '10.20383/103.01279';
export const PACK_DIR = 'public/bn-rrm/packs/bnrrm-casestudy-jermilova2025-mackenzie-hg';

// source_sha256: the exact bytes copied from the source repository (asset-manifest.json
// before this correction). corrected_sha256: the same bytes after the identifier swap.
export const CORRECTIONS = [
  {
    key: 'pack',
    path: 'pack.json',
    wrong: WRONG_FRDR_DOIS[0],
    count: 1,
    source_sha256: '24b322e8b8389164c58a15d9e8b29e35fe794dbdbdf9ee7b6606947e7a4bf17b',
  },
  {
    key: 'model_overview',
    path: 'review/model_overview.json',
    wrong: WRONG_FRDR_DOIS[0],
    count: 1,
    source_sha256: '14f0676a726fa92cadf8f864d31637812d79dff0dd029ffc8ded72de3e13e418',
  },
  {
    key: 'provenance',
    path: 'review/provenance_registry.json',
    wrong: WRONG_FRDR_DOIS[0],
    count: 2,
    source_sha256: '9a3e6f8376adfc7a8b9371198dd917c3951908c9d52e419da7a802a9ca93f959',
  },
  {
    key: 'training_data',
    path: 'training_data.json',
    wrong: WRONG_FRDR_DOIS[1],
    count: 1,
    source_sha256: 'e6ad4be9580067ed67da5e55f1c9e2ab40cc5e3ff33037cac05803d7b4684931',
  },
];

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const occurrences = (text, needle) => text.split(needle).length - 1;

// Source text -> corrected text. Fails unless the wrong identifier occurs exactly `count`
// times and the source version does not occur yet.
export function applyCorrection(text, entry) {
  if (occurrences(text, entry.wrong) !== entry.count || occurrences(text, SOURCE_VERSION_DOI) !== 0) {
    throw new Error(`${entry.path}: unexpected identifier occurrences`);
  }
  return text.split(entry.wrong).join(SOURCE_VERSION_DOI);
}

// Corrected text -> source text. Used to prove that nothing but the identifier changed.
export function revertCorrection(text, entry) {
  if (occurrences(text, SOURCE_VERSION_DOI) !== entry.count || WRONG_FRDR_DOIS.some((doi) => text.includes(doi))) {
    throw new Error(`${entry.path}: unexpected identifier occurrences`);
  }
  return text.split(SOURCE_VERSION_DOI).join(entry.wrong);
}

const readText = (rel) => readFile(path.join(repoRoot, ...rel.split('/')), 'utf8');
const writeText = (rel, text) => writeFile(path.join(repoRoot, ...rel.split('/')), text, 'utf8');
const toJson = (value) => JSON.stringify(value, null, 2) + '\n';

function getPathValue(value, fieldPath) {
  return fieldPath.split('.').reduce((current, part) => (current && typeof current === 'object' ? current[part] : undefined), value);
}

// Recomputes asset-manifest.json, claim-register.json and the two pins in
// scripts/check-assets.mjs. Pack bytes come from `pending` (in-memory corrected texts, keyed
// by pack-relative path) where given, otherwise from disk. Returns [current, new] texts.
async function integrityRecords(pending = new Map()) {
  const manifestText = await readText('asset-manifest.json');
  const registerText = await readText('claim-register.json');
  const checkAssetsText = await readText('scripts/check-assets.mjs');
  const manifest = JSON.parse(manifestText);
  const register = JSON.parse(registerText);

  const artifacts = {};
  const oldHashes = {};
  const correctedKeys = new Set(CORRECTIONS.map((entry) => entry.key));
  for (const asset of manifest.assets) {
    const bytes = pending.has(asset.path)
      ? Buffer.from(pending.get(asset.path), 'utf8')
      : await readFile(path.join(repoRoot, ...PACK_DIR.split('/'), ...asset.path.split('/')));
    oldHashes[asset.key] = asset.sha256;
    if (correctedKeys.has(asset.key)) {
      asset.sha256 = sha256(bytes);
      asset.bytes = bytes.length;
    } else if (sha256(bytes) !== asset.sha256 || bytes.length !== asset.bytes) {
      // Only the four corrected files may change; any other difference is refused, never
      // re-recorded.
      throw new Error(`${asset.path}: differs from asset-manifest.json and is not a corrected file`);
    }
    if (asset.path.endsWith('.json')) artifacts[asset.key] = JSON.parse(bytes.toString('utf8'));
  }
  manifest.provenance.identifier_correction = {
    note: 'The FRDR dataset identifier in these four files was corrected to the source version the article cites (doi:10.20383/103.0957). No other byte changed. sha256/bytes above are the corrected files; inventory_* still record the original physical bytes. Reproduce or verify with scripts/correct-frdr-doi.mjs.',
    files: CORRECTIONS.map((entry) => ({
      path: entry.path,
      source_sha256: entry.source_sha256,
      corrected_sha256: manifest.assets.find((asset) => asset.key === entry.key).sha256,
    })),
  };

  const newHashes = Object.fromEntries(manifest.assets.map((asset) => [asset.key, asset.sha256]));
  for (const claim of register.claims) {
    if (claim.artifact_sha256 !== oldHashes[claim.artifact_key] && claim.artifact_sha256 !== newHashes[claim.artifact_key]) {
      throw new Error(`claim ${claim.id} is bound to an unknown artifact hash`);
    }
    claim.artifact_sha256 = newHashes[claim.artifact_key];
    const excerpt = sha256(JSON.stringify(getPathValue(artifacts[claim.artifact_key], claim.field_path)));
    // Only the omitted dataset-identifier row may change its excerpt; every displayed value
    // (and so every scientific value) must hash exactly as before.
    if (excerpt !== claim.excerpt_sha256 && claim.id !== 'dataset-repository-doi') {
      throw new Error(`claim ${claim.id} excerpt changed`);
    }
    claim.excerpt_sha256 = excerpt;
  }

  const newManifestText = toJson(manifest);
  const newRegisterText = toJson(register);
  const pin = (name, value, text) => {
    const re = new RegExp(`(export const ${name} = ')[0-9a-f]{64}(';)`);
    if (!re.test(text)) throw new Error(`pin ${name} not found`);
    return text.replace(re, `$1${value}$2`);
  };
  let newCheckAssetsText = pin('ASSET_MANIFEST_SHA256', sha256(Buffer.from(newManifestText, 'utf8')), checkAssetsText);
  newCheckAssetsText = pin('CLAIM_REGISTER_SHA256', sha256(Buffer.from(newRegisterText, 'utf8')), newCheckAssetsText);
  return {
    'asset-manifest.json': [manifestText, newManifestText],
    'claim-register.json': [registerText, newRegisterText],
    'scripts/check-assets.mjs': [checkAssetsText, newCheckAssetsText],
  };
}

// Verifies the corrected state without writing. Returns a list of problems.
export async function checkCorrection() {
  const problems = [];
  for (const entry of CORRECTIONS) {
    const text = await readText(`${PACK_DIR}/${entry.path}`);
    try {
      if (sha256(Buffer.from(revertCorrection(text, entry), 'utf8')) !== entry.source_sha256) {
        problems.push(`${entry.path}: reverting the identifier does not give the source bytes`);
      }
    } catch (error) {
      problems.push(error.message);
    }
  }
  if (!problems.length) {
    for (const [file, [current, expected]] of Object.entries(await integrityRecords())) {
      if (current !== expected) problems.push(`${file}: integrity records are stale`);
    }
  }
  return problems;
}

// Validates every input and derives every output -- the corrected pack texts and all
// integrity records -- in memory before the first write. Any refusal (unexpected source
// bytes, a changed non-corrected pack file, a changed claim value) therefore leaves every
// file untouched.
async function writeCorrection() {
  const pending = new Map();
  for (const entry of CORRECTIONS) {
    const text = await readText(`${PACK_DIR}/${entry.path}`);
    if (sha256(Buffer.from(text, 'utf8')) === entry.source_sha256) {
      const corrected = applyCorrection(text, entry);
      if (sha256(Buffer.from(revertCorrection(corrected, entry), 'utf8')) !== entry.source_sha256) {
        throw new Error(`${entry.path}: correction is not reversible`);
      }
      pending.set(entry.path, corrected);
    } else if (sha256(Buffer.from(revertCorrection(text, entry), 'utf8')) !== entry.source_sha256) {
      throw new Error(`${entry.path}: neither the source nor the corrected bytes`);
    }
  }
  const records = await integrityRecords(pending);
  for (const [rel, text] of pending) await writeText(`${PACK_DIR}/${rel}`, text);
  for (const [file, [current, expected]] of Object.entries(records)) {
    if (current !== expected) await writeText(file, expected);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  if (process.argv[2] === '--write') await writeCorrection();
  else if (process.argv[2] !== '--check') {
    console.error('Usage: node scripts/correct-frdr-doi.mjs --check | --write');
    process.exit(2);
  }
  const problems = await checkCorrection();
  console.log(JSON.stringify({ status: problems.length ? 'FAIL' : 'PASS', problems }, null, 2));
  if (problems.length) process.exitCode = 1;
}
