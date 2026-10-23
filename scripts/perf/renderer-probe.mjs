import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export function scanPlaywrightCache(cacheDir, { readdir = readdirSync, exists = existsSync } = {}) {
  let entries;
  try {
    entries = readdir(cacheDir);
  } catch {
    return null;
  }
  const candidates = [];
  for (const entry of entries) {
    const name = typeof entry === 'string' ? entry : entry.name;
    if (name.startsWith('chromium_headless_shell-')) {
      candidates.push(join(cacheDir, name, 'chrome-headless-shell-linux64/chrome-headless-shell'));
    } else if (name.startsWith('chromium-')) {
      candidates.push(join(cacheDir, name, 'chrome-linux64/chrome'));
    }
  }
  candidates.sort().reverse();
  for (const candidate of candidates) {
    if (exists(candidate)) return candidate;
  }
  return null;
}

export function resolveChromiumExecutable(
  chromium,
  { env = process.env, home = homedir(), exists = existsSync, readdir = readdirSync } = {},
) {
  if (env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH && exists(env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH)) {
    return env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  }
  for (const channel of [undefined, 'chromium-headless-shell']) {
    try {
      const candidate = channel === undefined ? chromium.executablePath() : chromium.executablePath(channel);
      if (candidate && exists(candidate)) return candidate;
    } catch {
    }
  }
  const cacheDir = env.PLAYWRIGHT_BROWSERS_PATH ?? join(home, '.cache/ms-playwright');
  return scanPlaywrightCache(cacheDir, { readdir, exists });
}

export function mermaidDocUrl(port, docName) {
  return `http://127.0.0.1:${port}/#/${encodeURIComponent(docName)}`;
}

export function rendererSnapshotScript() {
  return `(() => {
    const heap = performance.memory ? {
      usedJSHeapSize: performance.memory.usedJSHeapSize,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
    } : null;
    let scriptDuration = 0;
    for (const entry of performance.getEntriesByType('measure')) {
      if (entry.name === 'ScriptDuration' || entry.name.startsWith('ScriptDuration')) {
        scriptDuration += entry.duration;
      }
    }
    for (const entry of performance.getEntriesByType('longtask')) {
      scriptDuration += entry.duration;
    }
    return {
      heap,
      domNodes: document.querySelectorAll('*').length,
      scriptDurationMs: scriptDuration,
      readyState: document.readyState,
      hash: window.location.hash,
    };
  })()`;
}

export function performanceMemoryScript() {
  return `(() => {
    if (!performance.memory) return null;
    return { usedJSHeapSize: performance.memory.usedJSHeapSize, totalJSHeapSize: performance.memory.totalJSHeapSize };
  })()`;
}

export function bytesToMB(bytes) {
  return bytes / (1024 * 1024);
}

export function shapeRendererResult({ heap, domNodes, scriptDurationMs, mermaidOpenMs }) {
  return {
    jsHeapUsedMB: heap ? bytesToMB(heap.usedJSHeapSize) : null,
    jsHeapTotalMB: heap ? bytesToMB(heap.totalJSHeapSize) : null,
    domNodesMermaidDoc: typeof domNodes === 'number' ? domNodes : null,
    scriptDurationMs: typeof scriptDurationMs === 'number' ? scriptDurationMs : null,
    mermaidOpenMs: typeof mermaidOpenMs === 'number' ? mermaidOpenMs : null,
  };
}
