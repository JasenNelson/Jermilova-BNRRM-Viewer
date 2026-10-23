// Monitored clean production build: `npm run build:monitored`.
//
// Removes .next/ and out/ (build output only), runs `npm run build` (asset check, next build,
// CSP step, export audit) and watches it:
//   - heartbeat line every --heartbeat seconds (default 15);
//   - stall watchdog: stops the build if it prints nothing for --stall seconds (default 240);
//   - hard timeout: --timeout seconds (default 900);
//   - on stop, the whole process tree is terminated;
//   - status JSON {status, last_progress_at, output_artifacts, ...} in .build-monitor.json.
// Exit code: the build's own code, or 124 on timeout/stall.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? Number(process.argv[index + 1]) : fallback;
};
const timeoutSeconds = arg('timeout', 900);
const stallSeconds = arg('stall', 240);
const heartbeatSeconds = arg('heartbeat', 15);
const statusFile = path.join(repoRoot, '.build-monitor.json');
const started = Date.now();
let lastProgress = Date.now();
let lines = 0;

function writeStatus(status, extra = {}) {
  const artifacts = ['out/index.html', 'out/bn-rrm/pack-registry.json'].filter((f) => existsSync(path.join(repoRoot, f)));
  writeFileSync(statusFile, JSON.stringify({
    status,
    started_at: new Date(started).toISOString(),
    last_progress_at: new Date(lastProgress).toISOString(),
    elapsed_seconds: Math.round((Date.now() - started) / 1000),
    output_lines: lines,
    output_artifacts: artifacts,
    ...extra,
  }, null, 2) + '\n');
}

for (const dir of ['.next', 'out']) {
  const full = path.join(repoRoot, dir);
  // Only these two generated folders, and never through a link.
  if (existsSync(full)) rmSync(full, { recursive: true, force: true });
}
writeStatus('running');

const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], {
  cwd: repoRoot,
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: process.platform === 'win32',
  detached: process.platform !== 'win32',
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
});

const onOutput = (stream) => (chunk) => {
  lastProgress = Date.now();
  lines += String(chunk).split('\n').length - 1;
  stream.write(chunk);
};
child.stdout.on('data', onOutput(process.stdout));
child.stderr.on('data', onOutput(process.stderr));

let stopped = null;
function killTree() {
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already gone */ }
}

const timer = setInterval(() => {
  const now = Date.now();
  const elapsed = Math.round((now - started) / 1000);
  const quiet = Math.round((now - lastProgress) / 1000);
  console.log(`[build-monitor] heartbeat elapsed=${elapsed}s quiet=${quiet}s lines=${lines}`);
  if (elapsed > timeoutSeconds) stopped = 'timeout';
  else if (quiet > stallSeconds) stopped = 'stalled';
  if (stopped) {
    console.error(`[build-monitor] ${stopped}; stopping the build process tree`);
    killTree();
  }
  writeStatus(stopped ?? 'running');
}, heartbeatSeconds * 1000);

child.on('exit', (code, signal) => {
  clearInterval(timer);
  const exitCode = stopped ? 124 : (code ?? 1);
  const status = stopped ?? (exitCode === 0 ? 'passed' : 'failed');
  writeStatus(status, { exit_code: exitCode, signal: signal ?? null });
  console.log(`[build-monitor] ${status} exit=${exitCode} elapsed=${Math.round((Date.now() - started) / 1000)}s`);
  process.exit(exitCode);
});
