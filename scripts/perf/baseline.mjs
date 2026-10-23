#!/usr/bin/env node
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { defaultOutDir, parseBaselineArgs, runtimesFor, USAGE } from './args.mjs';
import {
  baselineJsonFilename,
  baselineMarkdownFilename,
  MERMAID_DOC_NAME,
} from './constants.mjs';
import { fixturePlan, writeFixture } from './fixture.mjs';
import { bytesToKB, modulepreloadHrefs, summarizeBundle } from './bundle-probe.mjs';
import { buildBaselineReport, emptyRunShape, renderMarkdownSummary } from './report.mjs';
import { writeHookModule } from './hooks.mjs';
import {
  isProcessAlive,
  measureIdleWindow,
  okEnv,
  runOkSync,
  spawnServer,
  stopViaOk,
  waitForHealth,
  waitForServerLock,
} from './server-lifecycle.mjs';
import { mermaidDocUrl, rendererSnapshotScript, resolveChromiumExecutable, shapeRendererResult } from './renderer-probe.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../..');
const CLI_BIN = join(REPO_ROOT, 'packages/cli/dist/cli.mjs');
const APP_DIST = join(REPO_ROOT, 'packages/app/dist');
const APP_REQUIRE = createRequire(join(REPO_ROOT, 'packages/app/package.json'));

function log(message) {
  process.stdout.write(`[perf:baseline] ${message}\n`);
}

function warn(message) {
  process.stderr.write(`[perf:baseline] ${message}\n`);
}

function makeTmpRoot(keep) {
  const root = mkdtempSync(join(tmpdir(), 'ok-perf-baseline-'));
  return {
    root,
    dispose() {
      if (!keep) rmSync(root, { recursive: true, force: true });
    },
  };
}

function ensureCliBuilt() {
  if (!existsSync(CLI_BIN)) {
    throw new Error(`CLI bundle missing at ${CLI_BIN}; run pnpm run build first`);
  }
}

function measureBundle() {
  const indexHtml = join(APP_DIST, 'index.html');
  if (!existsSync(indexHtml)) {
    return {
      bundle: { initialJsGzipKB: null, initialJsRawKB: null, initialModuleCount: null },
      skip: { scope: 'bundle', reason: `no built app at ${indexHtml}; run pnpm run build first` },
    };
  }
  const hrefs = modulepreloadHrefs(readFileSync(indexHtml, 'utf-8'));
  const summary = summarizeBundle({
    hrefs,
    distDir: APP_DIST,
    readFile: (path) => readFileSync(path),
  });
  return {
    bundle: {
      initialJsGzipKB: bytesToKB(summary.gzipBytes),
      initialJsRawKB: bytesToKB(summary.rawBytes),
      initialModuleCount: summary.moduleCount,
    },
    skip: null,
  };
}

function initProject({ runtime, projectDir, homeDir }) {
  const env = okEnv({ homeDir });
  return runOkSync({
    runtime,
    cliBin: CLI_BIN,
    args: ['init', '--no-mcp', '--no-skills', '--local-only', '--content-dir', '.'],
    cwd: projectDir,
    env,
  });
}

async function startMeasuredServer({ runtime, projectDir, homeDir, tmpRoot, startupTimeoutSeconds }) {
  const hookModule = writeHookModule(join(tmpRoot, `ok-perf-hook-${runtime}-${Date.now()}.mjs`));
  const env = okEnv({ homeDir, hookReport: `${tmpRoot}/ok-perf-hook.json` });
  const startedAt = Date.now();
  const logChunks = [];
  const child = spawnServer({ runtime, cliBin: CLI_BIN, cwd: projectDir, env, hookModule });
  child.stdout?.on('data', (chunk) => logChunks.push(String(chunk).slice(-4000)));
  child.stderr?.on('data', (chunk) => logChunks.push(String(chunk).slice(-4000)));
  const logTail = () => logChunks.join('').slice(-4000);
  const waited = await waitForServerLock(projectDir, {
    timeoutMs: startupTimeoutSeconds * 1000,
    child,
    logTail,
  });
  if (!waited.lock) {
    try {
      child.kill('SIGTERM');
    } catch {
    }
    return { child: null, lock: null, startupMs: null, error: waited };
  }
  const healthy = await waitForHealth(waited.lock.port, { timeoutMs: 15_000 });
  if (!healthy) warn(`server on port ${waited.lock.port} never answered /healthz; continuing`);
  return { child, lock: waited.lock, startupMs: Date.now() - startedAt, env, logTail };
}

function stopServer({ runtime, projectDir, homeDir, child }) {
  const env = okEnv({ homeDir });
  const result = stopViaOk({ runtime, cliBin: CLI_BIN, projectDir, env });
  return { ...result, childExited: child.exitCode !== null || child.signalCode !== null };
}

async function probeRenderer({ port, timeoutMs = 60_000 }) {
  let chromium;
  try {
    ({ chromium } = APP_REQUIRE('playwright'));
  } catch (error) {
    return { result: null, skip: { scope: 'renderer', reason: `playwright unavailable: ${error.message}` } };
  }
  const executablePath = resolveChromiumExecutable(chromium);
  if (!executablePath) {
    return { result: null, skip: { scope: 'renderer', reason: 'no chromium executable in the playwright cache; set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH' } };
  }
  let browser = null;
  try {
    browser = await chromium.launch({ headless: true, executablePath });
    const page = await browser.newPage();
    const url = mermaidDocUrl(port, MERMAID_DOC_NAME);
    const openStart = Date.now();
    await page.goto(url, { timeout: timeoutMs, waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.ProseMirror:not(.composer-prosemirror)', { timeout: timeoutMs });
    const mermaidOpenMs = Date.now() - openStart;
    await page.waitForTimeout(2000);
    const snapshot = await page.evaluate(rendererSnapshotScript());
    const result = shapeRendererResult({
      heap: snapshot.heap,
      domNodes: snapshot.domNodes,
      scriptDurationMs: snapshot.scriptDurationMs,
      mermaidOpenMs,
    });
    return { result, skip: null };
  } catch (error) {
    return { result: null, skip: { scope: 'renderer', reason: String(error?.message ?? error).slice(0, 300) } };
  } finally {
    await browser?.close().catch(() => {});
  }
}

async function runOnce({ runtime, projectDirs, homeDir, tmpRoot, opts }) {
  const shape = emptyRunShape();
  const skipped = [];
  const primaryDir = projectDirs[0];
  const started = await startMeasuredServer({
    runtime,
    projectDir: primaryDir,
    homeDir,
    tmpRoot,
    startupTimeoutSeconds: opts.startupTimeoutSeconds,
  });
  if (!started.lock || !started.child) {
    const detail = started.error?.timedOut
      ? `server.lock never populated after ${opts.startupTimeoutSeconds}s`
      : `server exited before binding a port`;
    const tail = started.error?.logTail ? `\n${started.error.logTail}` : '';
    warn(`${runtime}: ${detail}${tail}`);
    skipped.push({ scope: `server:${runtime}`, reason: `${detail}${tail ? `: ${tail.slice(1, 301)}` : ''}` });
    return { run: shape, skipped };
  }
  const { child, lock } = started;
  shape.server.startupMs = started.startupMs;
  log(`${runtime}: server up on port ${lock.port} (pid ${lock.pid}, startup ${started.startupMs}ms)`);
  try {
    const idle = await measureIdleWindow({ pid: lock.pid, port: lock.port, tmpDir: tmpRoot, seconds: opts.idleSeconds });
    Object.assign(shape.server, {
      rssMB: idle.rssMB,
      pssMB: idle.pssMB,
      heapUsedMB: idle.heapUsedMB,
      heapTotalMB: idle.heapTotalMB,
      idleCpuSec60: idle.idleCpuSec,
      fsStatCallsIdle: idle.fsStatCallsIdle,
      fsReaddirCallsIdle: idle.fsReaddirCallsIdle,
      timerCallsIdle: idle.timerCallsIdle,
    });
    if (!opts.skipRenderer) {
      const { result, skip } = await probeRenderer({ port: lock.port });
      if (result) Object.assign(shape.renderer, result);
      if (skip) skipped.push(skip);
    } else {
      skipped.push({ scope: 'renderer', reason: '--skip-renderer' });
    }
  } finally {
    const stopped = stopServer({ runtime, projectDir: primaryDir, homeDir, child });
    if (stopped.error || stopped.status !== 0) {
      warn(`${runtime}: ok stop exited ${stopped.status}: ${stopped.stderr.slice(-500)}`);
    }
    const deadline = Date.now() + 10_000;
    while (isProcessAlive(lock.pid) && Date.now() < deadline) {
      await new Promise((resolveSleep) => setTimeout(resolveSleep, 250));
    }
    if (isProcessAlive(lock.pid)) {
      warn(`${runtime}: pid ${lock.pid} still alive after ok stop; leaving it alone (not our signal target beyond own spawn)`);
    }
  }
  return { run: shape, skipped };
}

async function main(argv) {
  const opts = parseBaselineArgs(argv);
  if (opts.help) {
    process.stdout.write(USAGE);
    return 0;
  }
  ensureCliBuilt();
  const runtimes = runtimesFor(opts);
  const outDir = opts.outDir ? resolve(opts.outDir) : defaultOutDir(REPO_ROOT);
  mkdirSync(outDir, { recursive: true });
  const tmp = makeTmpRoot(opts.keepTmp);
  const skipped = [];
  try {
    const plan = fixturePlan({ seed: opts.seed, noteCount: opts.noteCount, diagramCount: opts.diagramCount });
    const vaultCount = opts.multiVault ? 3 : 1;
    const projectDirs = [];
    for (let v = 0; v < vaultCount; v += 1) {
      const projectDir = join(tmp.root, `vault-${v}`);
      writeFixture(projectDir, plan);
      projectDirs.push(projectDir);
    }
    const homeDir = join(tmp.root, 'home');
    mkdirSync(homeDir, { recursive: true });
    let bundle = { initialJsGzipKB: null, initialJsRawKB: null, initialModuleCount: null };
    if (!opts.skipBundle) {
      const measured = measureBundle();
      bundle = measured.bundle;
      if (measured.skip) skipped.push(measured.skip);
    } else {
      skipped.push({ scope: 'bundle', reason: '--skip-bundle' });
    }
    for (const projectDir of projectDirs) {
      const inited = initProject({ runtime: 'node', projectDir, homeDir });
      if (inited.status !== 0) {
        throw new Error(`ok init failed in ${projectDir}: ${inited.stderr.slice(-2000)}`);
      }
    }
    const runs = [];
    for (const runtime of runtimes) {
      const runtimeRuns = [];
      for (let r = 0; r < opts.runs; r += 1) {
        log(`${runtime}: run ${r + 1}/${opts.runs} (idle ${opts.idleSeconds}s)`);
        const { run, skipped: runSkipped } = await runOnce({
          runtime,
          projectDirs,
          homeDir,
          tmpRoot: tmp.root,
          opts,
        });
        runtimeRuns.push(run);
        skipped.push(...runSkipped);
      }
      runs.push({ runtime, runs: runtimeRuns, skipped: [] });
    }
    const report = buildBaselineReport({
      generatedAt: new Date().toISOString(),
      runtime: opts.runtime,
      durations: { idleSeconds: opts.idleSeconds },
      fixture: { ...plan, vaults: vaultCount },
      runs,
      bundle,
      skipped,
      cli: { node: process.version },
    });
    const jsonPath = join(outDir, baselineJsonFilename());
    const mdPath = join(outDir, baselineMarkdownFilename());
    writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf-8');
    writeFileSync(mdPath, renderMarkdownSummary(report), 'utf-8');
    log(`wrote ${jsonPath}`);
    log(`wrote ${mdPath}`);
    return 0;
  } finally {
    tmp.dispose();
  }
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invoked) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      warn(error instanceof Error ? error.stack ?? error.message : String(error));
      process.exitCode = 1;
    },
  );
}

export { main };
