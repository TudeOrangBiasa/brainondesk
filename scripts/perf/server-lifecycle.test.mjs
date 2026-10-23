import { describe, expect, test } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hookReportPath } from './hooks.mjs';
import {
  isolatedHomeEnv,
  measureIdleWindow,
  okEnv,
  runtimeCommand,
  runtimeStartArgs,
  waitForHookReport,
} from './server-lifecycle.mjs';


describe('isolatedHomeEnv', () => {
  test('redirects HOME and XDG dirs into the temp home', () => {
    expect(isolatedHomeEnv('/tmp/h')).toEqual({
      HOME: '/tmp/h',
      XDG_CONFIG_HOME: '/tmp/h/.config',
      XDG_CACHE_HOME: '/tmp/h/.cache',
      XDG_DATA_HOME: '/tmp/h/.local/share',
      XDG_STATE_HOME: '/tmp/h/.local/state',
    });
  });
});

describe('runtimeCommand', () => {
  test('node reuses the current interpreter, bun shells out', () => {
    expect(runtimeCommand('node')).toBe(process.execPath);
    expect(runtimeCommand('bun')).toBe('bun');
  });
});

describe('runtimeStartArgs', () => {
  test('node prepends --import, bun prepends --preload', () => {
    expect(runtimeStartArgs('node', '/cli.mjs', '/hook.mjs').slice(0, 3)).toEqual([
      '--import',
      '/hook.mjs',
      '/cli.mjs',
    ]);
    expect(runtimeStartArgs('bun', '/cli.mjs', '/hook.mjs').slice(0, 3)).toEqual([
      '--preload',
      '/hook.mjs',
      '/cli.mjs',
    ]);
  });

  test('start flags pin port 0, no browser, and no idle shutdown', () => {
    const args = runtimeStartArgs('node', '/cli.mjs', null);
    expect(args).toEqual(['/cli.mjs', 'start', '--port', '0', '--no-open-browser', '--idle-shutdown', 'off']);
  });
});

describe('hook wiring', () => {
  test('okEnv carries OK_PERF_HOOK_REPORT into the spawned server env', () => {
    const env = okEnv({ homeDir: '/tmp/h', hookReport: '/tmp/t/ok-perf-hook.json' });
    expect(env.OK_PERF_HOOK_REPORT).toBe('/tmp/t/ok-perf-hook.json');
  });

  test('spawnServer builds on runtimeStartArgs so the hook prefix reaches the child', () => {
    expect(runtimeStartArgs('node', '/cli.mjs', '/hook.mjs')[0]).toBe('--import');
    expect(runtimeStartArgs('node', '/cli.mjs', '/hook.mjs')[1]).toBe('/hook.mjs');
    expect(runtimeStartArgs('node', '/cli.mjs', null)[0]).toBe('/cli.mjs');
  });

  test('a stale report with no live reporter reads as missing after the reset', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ok-perf-idle-'));
    const idle = await measureIdleWindow({ pid: 1, port: 1, tmpDir: dir, seconds: 0, hookTimeoutMs: 300 });
    expect(idle.timerCallsIdle).toBeNull();
    expect(idle.fsStatCallsIdle).toBeNull();
    expect(idle.hookReporterReady).toBe(false);
    const written = mkdtempSync(join(tmpdir(), 'ok-perf-idle-'));
    writeFileSync(hookReportPath(written), JSON.stringify({ fsStat: 8000, fsReaddir: 900, timers: 5000 }), 'utf-8');
    const stale = await measureIdleWindow({ pid: 1, port: 1, tmpDir: written, seconds: 0, hookTimeoutMs: 300 });
    expect(stale.timerCallsIdle).toBeNull();
    expect(stale.fsStatCallsIdle).toBeNull();
    expect(stale.hookReporterReady).toBe(false);
  });

  test('a reporter slower than one tick still seeds the before sample via polling', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ok-perf-slow-'));
    const counters = { fsStat: 10, fsReaddir: 4, timers: 6 };
    const slow = setTimeout(() => {
      writeFileSync(hookReportPath(dir), JSON.stringify({ ...counters }), 'utf-8');
      const ticking = setInterval(() => {
        counters.fsStat += 2;
        counters.fsReaddir += 1;
        counters.timers += 3;
        writeFileSync(hookReportPath(dir), JSON.stringify({ ...counters }), 'utf-8');
      }, 100);
      ticking.unref?.();
      setTimeout(() => clearInterval(ticking), 1500).unref?.();
    }, 1500);
    try {
      const idle = await measureIdleWindow({ pid: 1, port: 1, tmpDir: dir, seconds: 0, hookTimeoutMs: 5000 });
      expect(idle.hookReporterReady).toBe(true);
      expect(idle.fsStatCallsIdle).not.toBeNull();
      expect(idle.timerCallsIdle).not.toBeNull();
    } finally {
      clearTimeout(slow);
    }
  });

  test('waitForHookReport returns null on timeout and the live report when present', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ok-perf-wait-'));
    await expect(waitForHookReport(hookReportPath(dir), { timeoutMs: 200, pollMs: 50 })).resolves.toBeNull();
    writeFileSync(hookReportPath(dir), JSON.stringify({ fsStat: 3, fsReaddir: 1, timers: 2 }), 'utf-8');
    await expect(waitForHookReport(hookReportPath(dir), { timeoutMs: 500 })).resolves.toMatchObject({
      fsStat: 3,
      fsReaddir: 1,
      timers: 2,
    });
  });
});
