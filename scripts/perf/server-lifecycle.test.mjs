import { describe, expect, test } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hookReportPath } from './hooks.mjs';
import { isolatedHomeEnv, measureIdleWindow, okEnv, runtimeCommand, runtimeStartArgs } from './server-lifecycle.mjs';


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
    const idle = await measureIdleWindow({ pid: 1, port: 1, tmpDir: dir, seconds: 0 });
    expect(idle.timerCallsIdle).toBeNull();
    expect(idle.fsStatCallsIdle).toBeNull();
    const written = mkdtempSync(join(tmpdir(), 'ok-perf-idle-'));
    writeFileSync(hookReportPath(written), JSON.stringify({ fsStat: 8000, fsReaddir: 900, timers: 5000 }), 'utf-8');
    const stale = await measureIdleWindow({ pid: 1, port: 1, tmpDir: written, seconds: 0 });
    expect(stale.timerCallsIdle).toBeNull();
    expect(stale.fsStatCallsIdle).toBeNull();
  });

  test('sequential runs ignore the previous run report and measure the live reporter', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ok-perf-rerun-'));
    writeFileSync(hookReportPath(dir), JSON.stringify({ fsStat: 8000, fsReaddir: 900, timers: 5000 }), 'utf-8');
    const counters = { fsStat: 0, fsReaddir: 0, timers: 0 };
    const reporter = setInterval(() => {
      counters.fsStat += 1;
      counters.fsReaddir += 1;
      counters.timers += 1;
      writeFileSync(hookReportPath(dir), JSON.stringify({ ...counters }), 'utf-8');
    }, 100);
    try {
      const idle = await measureIdleWindow({ pid: 1, port: 1, tmpDir: dir, seconds: 1 });
      expect(idle.fsStatCallsIdle).toBeGreaterThan(0);
      expect(idle.fsReaddirCallsIdle).toBeGreaterThan(0);
      expect(idle.timerCallsIdle).toBeGreaterThan(0);
    } finally {
      clearInterval(reporter);
    }
  });
});
