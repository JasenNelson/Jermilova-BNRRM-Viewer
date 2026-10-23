// Scope and self-containment of the standalone repository.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(path.join(repoRoot, ...rel.split('/')), 'utf8');
const SHELL = 'forked/JermilovaBnrrmClient.tsx';
const SOURCE_DIRS = ['app', 'components', 'forked', 'lib', 'src', 'scripts', 'e2e'];
const ROOT_SOURCES = ['next.config.ts', 'vitest.config.ts', 'playwright.config.ts', 'viewer-capabilities.ts', 'postcss.config.mjs', 'eslint.config.mjs'];

function walk(dir: string): string[] {
  const full = path.join(repoRoot, dir);
  return readdirSync(full).flatMap((name) => {
    const rel = `${dir}/${name}`;
    return statSync(path.join(full, name)).isDirectory() ? walk(rel) : [rel];
  });
}

const codeFiles = [...SOURCE_DIRS.flatMap(walk), ...ROOT_SOURCES].filter((f) => /\.(ts|tsx|mjs|js|cjs)$/.test(f));
const cssFiles = SOURCE_DIRS.flatMap(walk).filter((f) => f.endsWith('.css'));

function resolveLocal(fromFile: string, spec: string): string | null {
  const base = spec.startsWith('@/')
    ? path.join(repoRoot, 'src', spec.slice(2))
    : path.resolve(path.dirname(path.join(repoRoot, fromFile)), spec);
  const candidates = ['', '.ts', '.tsx', '.js', '.mjs', '.json', '.css', '/index.ts', '/index.tsx'].map((ext) => base + ext);
  return candidates.find((c) => existsSync(c) && statSync(c).isFile()) ?? null;
}

function tabsOf(source: string) {
  return [...source.matchAll(/\{ id: '([a-z]+)', label: '([^']+)'/g)].map((m) => ({ id: m[1], label: m[2] }));
}

// Viewer files reachable by import from the route entry (app/page.tsx and app/layout.tsx).
function reachableFiles() {
  const seen = new Set<string>();
  const queue = ['app/page.tsx', 'app/layout.tsx'];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    if (!/\.(ts|tsx)$/.test(file)) continue;
    for (const ref of ts.preProcessFile(read(file), true, true).importedFiles) {
      if (!ref.fileName.startsWith('.') && !ref.fileName.startsWith('@/')) continue;
      const hit = resolveLocal(file, ref.fileName);
      if (hit) queue.push(path.relative(repoRoot, hit).split(path.sep).join('/'));
    }
  }
  return [...seen].sort();
}

describe('standalone scope', () => {
  it('every relative and @/ import in the repository resolves inside the repository', () => {
    const problems: string[] = [];
    for (const file of codeFiles) {
      for (const ref of ts.preProcessFile(read(file), true, true).importedFiles) {
        const spec = ref.fileName;
        if (!spec.startsWith('.') && !spec.startsWith('@/')) continue;
        const hit = resolveLocal(file, spec);
        if (!hit) problems.push(`${file}: unresolved ${spec}`);
        else if (path.relative(repoRoot, hit).startsWith('..')) problems.push(`${file}: outside the repository ${spec}`);
      }
    }
    for (const file of cssFiles) {
      for (const m of read(file).matchAll(/@(?:import|source)(?: not)? "([^"]+)"/g)) {
        if (m[1] === 'tailwindcss') continue;
        const target = path.resolve(path.dirname(path.join(repoRoot, file)), m[1].replace(/\*.*$/, ''));
        if (path.relative(repoRoot, target).startsWith('..')) problems.push(`${file}: outside the repository ${m[1]}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('has no scripts, aliases or configuration that reach outside the repository', () => {
    const pkg = JSON.parse(read('package.json'));
    for (const [name, command] of Object.entries(pkg.scripts as Record<string, string>)) {
      expect(command, name).not.toMatch(/\.\.[/\\]/);
    }
    const tsconfig = JSON.parse(read('tsconfig.json'));
    expect(tsconfig.compilerOptions.paths).toEqual({ '@/*': ['./src/*'] });
    for (const file of ['next.config.ts', 'tsconfig.json', 'vitest.config.ts', 'vercel.json']) {
      expect(read(file), file).not.toMatch(/\.\.\/|basePath|Jermilova'/);
    }
  });

  it('shows the six original tabs in source order, defaulting to Detailed BN', () => {
    const fork = tabsOf(read(SHELL));
    expect(fork.map((t) => t.label)).toEqual(['Guide', 'Conceptual', 'Detailed BN', 'CPT', 'Map', 'Data']);
    expect(read(SHELL)).toContain("useState<ViewTab>('detailed')");
    // The original Data tooltip text is kept verbatim.
    expect(read(SHELL)).toContain("{ id: 'data', label: 'Data', icon: Database, description: 'Upload & export' }");
  });

  it('mounts the read-only BN-RRM shell and its forks from the route entry', () => {
    expect(reachableFiles()).toEqual(expect.arrayContaining([
      'app/page.tsx',
      'components/JermilovaViewerClient.tsx',
      'forked/JermilovaBnrrmClient.tsx',
      'forked/Canvas.tsx',
      'forked/ResultsPanel.tsx',
      'forked/SiteMap.tsx',
      'forked/SiteDetails.tsx',
      'src/stores/bn-rrm/networkStore.ts',
      'src/stores/bn-rrm/siteDataStore.ts',
      'src/components/bn-rrm/panels/NodeInspector.tsx',
      'src/components/bn-rrm/cpt/CPTExplorer.tsx',
      'src/components/bn-rrm/data/BenchmarkDataViewer.tsx',
      'src/components/bn-rrm/getting-started/GettingStartedView.tsx',
      'src/components/bn-rrm/shared/PackBanner.tsx',
      'src/stores/bn-rrm/packStore.ts',
    ]));
  });

  it('ships only reachable source: every file under src/ is imported by the viewer', () => {
    const reachable = new Set(reachableFiles());
    const unreachable = walk('src').filter((f) => !reachable.has(f));
    expect(unreachable).toEqual([]);
  });

  it('keeps write, export, server and other-model code out of the forks and stores', () => {
    const cases: Array<[string, string[]]> = [
      [SHELL, ['PackSelector', 'ReviewView', 'CaseStudiesView', 'handleRunAssessment', 'addAssessment', 'loadTrainedModel()', 'DataUploader', 'ExportPanel', 'Benthic Risk Conceptual Model', 'Landis 2021']],
      ['forked/Canvas.tsx', ['onConnect', 'addEdge']],
      ['forked/ResultsPanel.tsx', ['bn-rrm-results-', 'createObjectURL']],
      ['forked/SiteMap.tsx', ["setInteractionMode('identify')", "setInteractionMode('identify-area')", '/api/bn-rrm/wms-identify', '/api/bn-rrm/wfs-identify', 'Export map image', 'html-to-image']],
      ['forked/SiteDetails.tsx', ['downloadJson', 'Export Identified', 'handleReportExport']],
      ['src/stores/bn-rrm/siteDataStore.ts', ['persist(', 'sstac-bn-rrm-site-data']],
      ['src/stores/bn-rrm/networkStore.ts', ["createTrainedNetwork('expert')", 'loadTrainedModel', 'loadDummyModel', 'createDummyNetwork', 'learned-model.json']],
    ];
    for (const [file, markers] of cases) {
      const text = read(file);
      for (const marker of markers) expect(text.includes(marker), `${file} has ${marker}`).toBe(false);
    }
  });

  it('has no authentication, database client, API route, server action or environment variable', () => {
    const forbidden = [/supabase/i, /next-auth/i, /['"]use server['"]/, /process\.env/, /NEXT_PUBLIC_/, /\/api\//, /localStorage\.setItem|sessionStorage\.setItem|document\.cookie\s*=/];
    const runtime = codeFiles.filter((f) => /^(app|components|forked|src)\//.test(f) || f === 'lib/loadJermilovaPack.ts' || f === 'lib/verifiedFetch.ts' || f === 'lib/validateJermilovaRuntime.ts');
    const hits: string[] = [];
    for (const file of runtime) {
      const text = read(file);
      for (const re of forbidden) if (re.test(text)) hits.push(`${file}: ${re}`);
    }
    expect(hits).toEqual([]);
    expect(existsSync(path.join(repoRoot, 'app', 'api'))).toBe(false);
    expect(existsSync(path.join(repoRoot, 'middleware.ts'))).toBe(false);
    const pkg = JSON.parse(read('package.json'));
    const deps = [...Object.keys(pkg.dependencies), ...Object.keys(pkg.devDependencies)];
    expect(deps.filter((d) => /supabase|auth|sentry/i.test(d))).toEqual([]);
  });

  it('styles the original components with the original stylesheet', () => {
    expect(read('app/globals.css')).toContain('@import "./bnrrm-base.css";');
    expect(read('app/layout.tsx')).toContain('<body className="antialiased">');
    expect(readdirSync(path.join(repoRoot, 'app')).sort()).toEqual(['bnrrm-base.css', 'globals.css', 'layout.tsx', 'page.tsx']);
  });

  it('asks search engines not to index the page', () => {
    expect(read('app/layout.tsx')).toContain('robots: { index: false, follow: false }');
  });

  it('offers exactly one pack, Jermilova, as the registry default', () => {
    const registry = JSON.parse(read('public/bn-rrm/pack-registry.json'));
    expect(registry.default_pack_id).toBe('bnrrm-casestudy-jermilova2025-mackenzie-hg');
    expect(registry.packs.map((p: { pack_id: string }) => p.pack_id)).toEqual(['bnrrm-casestudy-jermilova2025-mackenzie-hg']);
  });
});
