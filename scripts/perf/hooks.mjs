import { readFileSync, writeFileSync } from 'node:fs';

export function hookReportPath(tmpDir) {
  return `${tmpDir}/ok-perf-hook.json`;
}

export function readHookReportFile(path) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const mem = parsed.memory;
  const memory =
    mem && typeof mem === 'object'
      ? { rssMB: num(mem.rssMB), heapTotalMB: num(mem.heapTotalMB), heapUsedMB: num(mem.heapUsedMB) }
      : null;
  return { fsStat: num(parsed.fsStat), fsReaddir: num(parsed.fsReaddir), timers: num(parsed.timers), memory };
}

export function hookDelta(before, after) {
  if (!before || !after) return null;
  return {
    fsStat: Math.max(0, after.fsStat - before.fsStat),
    fsReaddir: Math.max(0, after.fsReaddir - before.fsReaddir),
    timers: Math.max(0, after.timers - before.timers),
  };
}

export function installPerfCounters({ fs = null, timers = null } = {}) {
  const counters = { fsStat: 0, fsReaddir: 0, timers: 0 };
  if (fs) {
    for (const name of ['statSync', 'lstatSync', 'fstatSync']) {
      const original = fs[name];
      if (typeof original !== 'function') continue;
      fs[name] = function hooked(...args) {
        counters.fsStat += 1;
        return original.apply(this, args);
      };
    }
    if (typeof fs.readdirSync === 'function') {
      const original = fs.readdirSync;
      fs.readdirSync = function hooked(...args) {
        counters.fsReaddir += 1;
        return original.apply(this, args);
      };
    }
    if (fs.promises) {
      for (const name of ['stat', 'lstat']) {
        const original = fs.promises[name];
        if (typeof original !== 'function') continue;
        fs.promises[name] = function hooked(...args) {
          counters.fsStat += 1;
          return original.apply(this, args);
        };
      }
      if (typeof fs.promises.readdir === 'function') {
        const original = fs.promises.readdir;
        fs.promises.readdir = function hooked(...args) {
          counters.fsReaddir += 1;
          return original.apply(this, args);
        };
      }
    }
  }
  if (timers) {
    for (const name of ['setTimeout', 'setInterval', 'setImmediate']) {
      const original = timers[name];
      if (typeof original !== 'function') continue;
      timers[name] = function hooked(...args) {
        counters.timers += 1;
        return original.apply(this, args);
      };
    }
  }
  return counters;
}

export function hookModuleSource() {
  return [
    `import fs, { writeFileSync } from 'node:fs';`,
    `import timers from 'node:timers';`,
    `const counters = { fsStat: 0, fsReaddir: 0, timers: 0 };`,
    `const report = process.env.OK_PERF_HOOK_REPORT;`,
    `for (const name of ['statSync', 'lstatSync', 'fstatSync']) {`,
    `  const original = fs[name];`,
    `  fs[name] = function (...args) { counters.fsStat += 1; return original.apply(this, args); };`,
    `}`,
    `if (typeof fs.readdirSync === 'function') {`,
    `  const original = fs.readdirSync;`,
    `  fs.readdirSync = function (...args) { counters.fsReaddir += 1; return original.apply(this, args); };`,
    `}`,
    `for (const name of ['stat', 'lstat']) {`,
    `  const original = fs.promises?.[name];`,
    `  if (typeof original === 'function') fs.promises[name] = function (...args) { counters.fsStat += 1; return original.apply(this, args); };`,
    `}`,
    `if (typeof fs.promises?.readdir === 'function') {`,
    `  const original = fs.promises.readdir;`,
    `  fs.promises.readdir = function (...args) { counters.fsReaddir += 1; return original.apply(this, args); };`,
    `}`,
    `for (const name of ['setTimeout', 'setInterval', 'setImmediate']) {`,
    `  const original = timers[name];`,
    `  timers[name] = function (...args) { counters.timers += 1; return original.apply(this, args); };`,
    `}`,
    `setInterval(() => {`,
    `  if (!report) return;`,
    `  let memory = null;`,
    `  try { const m = process.memoryUsage(); memory = { rssMB: m.rss / 1048576, heapTotalMB: m.heapTotal / 1048576, heapUsedMB: m.heapUsed / 1048576 }; } catch {}`,
    `  try { writeFileSync(report, JSON.stringify({ ...counters, memory, at: Date.now() }), 'utf-8'); } catch {}`,
    `}, 1000).unref?.();`,
    ``,
  ].join('\n');
}

export function writeHookModule(path) {
  writeFileSync(path, hookModuleSource(), 'utf-8');
  return path;
}
