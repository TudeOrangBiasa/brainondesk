import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import {
  cpuSecondsBetween,
  kernelTicksPerSecond,
  normalizeIdleCpuToSixty,
  parseServerLock,
  parseSmapsRollup,
  procStatCpuTicks,
  serverLockPath,
} from './proc-stats.mjs';
import { hookDelta, hookReportPath, readHookReportFile, resetHookReportFile } from './hooks.mjs';

export function isolatedHomeEnv(homeDir) {
  return {
    HOME: homeDir,
    XDG_CONFIG_HOME: `${homeDir}/.config`,
    XDG_CACHE_HOME: `${homeDir}/.cache`,
    XDG_DATA_HOME: `${homeDir}/.local/share`,
    XDG_STATE_HOME: `${homeDir}/.local/state`,
  };
}

export function okEnv({ homeDir, hookReport, extra = {} }) {
  return {
    ...process.env,
    ...isolatedHomeEnv(homeDir),
    DO_NOT_TRACK: '1',
    NODE_ENV: process.env.NODE_ENV ?? 'development',
    OK_PERF_SERVER_MEMORY_ENABLED: 'true',
    ...(hookReport ? { OK_PERF_HOOK_REPORT: hookReport } : {}),
    ...extra,
  };
}

export function runtimeCommand(runtime) {
  return runtime === 'bun' ? 'bun' : process.execPath;
}

export function runtimeStartArgs(runtime, cliBin, hookModule) {
  const base = ['start', '--port', '0', '--no-open-browser', '--idle-shutdown', 'off'];
  if (hookModule && runtime === 'node') return ['--import', hookModule, cliBin, ...base];
  if (hookModule && runtime === 'bun') return ['--preload', hookModule, cliBin, ...base];
  return [cliBin, ...base];
}

export function runOkSync({ runtime, cliBin, args, cwd, env, timeoutMs = 120_000 }) {
  const result = spawnSync(runtimeCommand(runtime), [cliBin, ...args], {
    cwd,
    env,
    encoding: 'utf-8',
    timeout: timeoutMs,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: result.error ? String(result.error) : null,
  };
}

export function spawnServer({ runtime, cliBin, cwd, env, hookModule, logPath }) {
  const child = spawn(runtimeCommand(runtime), runtimeStartArgs(runtime, cliBin, hookModule), {
    cwd,
    env,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (logPath) {
    child.stdout?.on('data', () => {});
    child.stderr?.on('data', () => {});
  }
  child.unref();
  return child;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function waitForServerLock(projectDir, { timeoutMs, child, logTail }) {
  const lockPath = serverLockPath(projectDir);
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (existsSync(lockPath)) {
      const lock = parseServerLock(readFileSync(lockPath, 'utf-8'));
      if (lock) return { lock, lockPath };
    }
    if (child.exitCode !== null || child.signalCode !== null) {
      return { lock: null, lockPath, exited: true, logTail: logTail() };
    }
    if (Date.now() >= deadline) return { lock: null, lockPath, timedOut: true, logTail: logTail() };
    await sleep(250);
  }
}

export async function waitForHealth(port, { timeoutMs }) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/healthz`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return true;
    } catch {
    }
    if (Date.now() >= deadline) return false;
    await sleep(250);
  }
}

export function readSmapsRollupKB(pid) {
  try {
    return parseSmapsRollup(readFileSync(`/proc/${pid}/smaps_rollup`, 'utf-8'));
  } catch {
    return { rssKB: null, pssKB: null };
  }
}

export function readCpuTicks(pid) {
  try {
    return procStatCpuTicks(readFileSync(`/proc/${pid}/stat`, 'utf-8'));
  } catch {
    return null;
  }
}

export async function fetchServerMemory(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/__ok_perf/server-memory`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.snapshot ?? null;
  } catch {
    return null;
  }
}

export function stopViaOk({ runtime, cliBin, projectDir, env, timeoutMs = 60_000 }) {
  return runOkSync({ runtime, cliBin, args: ['stop', '--force', projectDir], cwd: projectDir, env, timeoutMs });
}

export async function waitForHookReport(path, { timeoutMs = 15_000, pollMs = 100 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const report = readHookReportFile(path);
    if (report) return report;
    if (Date.now() >= deadline) return null;
    await sleep(Math.min(pollMs, Math.max(0, deadline - Date.now())));
  }
}

export async function measureIdleWindow({
  pid,
  port,
  tmpDir,
  seconds,
  hookTimeoutMs = 15_000,
  hookPollMs = 100,
}) {
  const reportPath = hookReportPath(tmpDir);
  resetHookReportFile(reportPath);
  const beforeHook = await waitForHookReport(reportPath, { timeoutMs: hookTimeoutMs, pollMs: hookPollMs });
  const beforeTicks = readCpuTicks(pid);
  await sleep(seconds * 1000);
  const afterTicks = readCpuTicks(pid);
  const smaps = readSmapsRollupKB(pid);
  const memory = await fetchServerMemory(port);
  const afterHook = readHookReportFile(hookReportPath(tmpDir));
  const ticksPerSecond = kernelTicksPerSecond();
  const rawCpuSec =
    beforeTicks && afterTicks ? cpuSecondsBetween(beforeTicks, afterTicks, ticksPerSecond) : null;
  const idleCpuSec = normalizeIdleCpuToSixty(rawCpuSec, seconds);
  const hook = hookDelta(beforeHook, afterHook);
  const heapUsedMB =
    typeof memory?.heapUsedMb === 'number' ? memory.heapUsedMb : (afterHook?.memory?.heapUsedMB ?? null);
  const heapTotalMB =
    typeof memory?.heapTotalMb === 'number' ? memory.heapTotalMb : (afterHook?.memory?.heapTotalMB ?? null);
  return {
    rssMB: smaps.rssKB === null ? null : smaps.rssKB / 1024,
    pssMB: smaps.pssKB === null ? null : smaps.pssKB / 1024,
    heapUsedMB,
    heapTotalMB,
    idleCpuSec,
    fsStatCallsIdle: hook?.fsStat ?? null,
    fsReaddirCallsIdle: hook?.fsReaddir ?? null,
    timerCallsIdle: hook?.timers ?? null,
    hookReporterReady: beforeHook !== null,
  };
}

export function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
