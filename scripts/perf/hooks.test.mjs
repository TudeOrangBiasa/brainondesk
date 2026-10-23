import { describe, expect, test } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hookDelta, hookModuleSource, hookReportPath, installPerfCounters, readHookReportFile, resetHookReportFile } from './hooks.mjs';

describe('hookReportPath', () => {
  test('pins the report filename inside the tmp dir', () => {
    expect(hookReportPath('/tmp/x')).toBe('/tmp/x/ok-perf-hook.json');
  });

  test('resetHookReportFile removes a stale report without failing when absent', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ok-perf-hooks-'));
    const path = join(dir, 'r.json');
    writeFileSync(path, JSON.stringify({ fsStat: 1 }), 'utf-8');
    resetHookReportFile(path);
    expect(readHookReportFile(path)).toBeNull();
    expect(() => resetHookReportFile(path)).not.toThrow();
  });
});
describe('readHookReportFile', () => {
  test('reads counters and coerces garbage to zero', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ok-perf-hooks-'));
    const path = join(dir, 'r.json');
    writeFileSync(path, JSON.stringify({ fsStat: 3, fsReaddir: 1, timers: 'x' }), 'utf-8');
    expect(readHookReportFile(path)).toEqual({ fsStat: 3, fsReaddir: 1, timers: 0, memory: null });
  });

  test('reads the in-process memory snapshot when present', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ok-perf-hooks-'));
    const path = join(dir, 'm.json');
    writeFileSync(
      path,
      JSON.stringify({ fsStat: 1, fsReaddir: 0, timers: 0, memory: { rssMB: 270, heapTotalMB: 100, heapUsedMB: 60 } }),
      'utf-8',
    );
    expect(readHookReportFile(path)?.memory).toEqual({ rssMB: 270, heapTotalMB: 100, heapUsedMB: 60 });
  });

  test('returns null for missing or corrupt files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ok-perf-hooks-'));
    expect(readHookReportFile(join(dir, 'missing.json'))).toBeNull();
    const bad = join(dir, 'bad.json');
    writeFileSync(bad, '{{{', 'utf-8');
    expect(readHookReportFile(bad)).toBeNull();
  });
});

describe('hookDelta', () => {
  test('subtracts and clamps at zero, null when a side is missing', () => {
    expect(
      hookDelta({ fsStat: 10, fsReaddir: 4, timers: 2 }, { fsStat: 13, fsReaddir: 4, timers: 9 }),
    ).toEqual({ fsStat: 3, fsReaddir: 0, timers: 7 });
    expect(hookDelta(null, { fsStat: 1, fsReaddir: 0, timers: 0 })).toBeNull();
    expect(hookDelta({ fsStat: 5, fsReaddir: 0, timers: 0 }, null)).toBeNull();
  });
});

describe('installPerfCounters', () => {
  test('counts sync stat/readdir and timer scheduling on fakes', () => {
    const fs = {
      statSync: () => 1,
      lstatSync: () => 1,
      fstatSync: () => 1,
      readdirSync: () => [],
      promises: { stat: async () => 1, lstat: async () => 1, readdir: async () => [] },
    };
    const timers = { setTimeout: () => 1, setInterval: () => 2, setImmediate: () => 3 };
    const counters = installPerfCounters({ fs, timers });
    fs.statSync('/x');
    fs.lstatSync('/x');
    fs.readdirSync('/x');
    void fs.promises.stat('/x');
    void fs.promises.readdir('/x');
    timers.setTimeout(() => {}, 1);
    timers.setInterval(() => {}, 1);
    expect(counters).toEqual({ fsStat: 3, fsReaddir: 2, timers: 2 });
  });

  test('mirrors hooked timers onto matching globals', () => {
    const seen = [];
    const fake = (...args) => {
      seen.push(args);
      return 7;
    };
    const real = globalThis.setImmediate;
    globalThis.setImmediate = fake;
    try {
      const timers = { setTimeout: () => 0, setInterval: () => 0, setImmediate: fake };
      const counters = installPerfCounters({ timers });
      expect(timers.setImmediate).not.toBe(fake);
      expect(globalThis.setImmediate).toBe(timers.setImmediate);
      globalThis.setImmediate(() => {}, 1);
      expect(counters.timers).toBe(1);
    } finally {
      globalThis.setImmediate = real;
    }
  });

  test('skips missing functions', () => {
    expect(installPerfCounters({ fs: {}, timers: {} })).toEqual({ fsStat: 0, fsReaddir: 0, timers: 0 });
  });
});

describe('hookModuleSource', () => {
  test('emits an importable module that wires the same three counter families', () => {
    const source = hookModuleSource();
    expect(source).toContain('OK_PERF_HOOK_REPORT');
    expect(source).toContain('statSync');
    expect(source).toContain('readdirSync');
    expect(source).toContain('setTimeout');
    expect(source).toContain('globalThis');
    expect(source).toContain('unref');
  });
});
