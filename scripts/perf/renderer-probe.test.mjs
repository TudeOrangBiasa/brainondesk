import { describe, expect, test } from 'vitest';
import { bytesToMB, mermaidDocUrl, resolveChromiumExecutable, scanPlaywrightCache, shapeRendererResult } from './renderer-probe.mjs';

describe('scanPlaywrightCache', () => {
  test('prefers the newest headless-shell, then full chromium', () => {
    const readdir = () => ['chromium-1248', 'chromium_headless_shell-1148', 'firefox-1'];
    const exists = (p) => !p.includes('firefox');
    expect(scanPlaywrightCache('/cache', { readdir, exists })).toBe(
      '/cache/chromium_headless_shell-1148/chrome-headless-shell-linux64/chrome-headless-shell',
    );
  });

  test('skips entries whose executable is absent', () => {
    const readdir = () => ['chromium-1248'];
    expect(scanPlaywrightCache('/cache', { readdir, exists: () => false })).toBeNull();
  });

  test('returns null when the cache dir is unreadable', () => {
    expect(scanPlaywrightCache('/cache', { readdir: () => { throw new Error('ENOENT'); } })).toBeNull();
  });
});

describe('resolveChromiumExecutable', () => {
  test('env override wins when the file exists', () => {
    const chromium = { executablePath: () => { throw new Error('nope'); } };
    const env = { PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH: '/custom/chrome' };
    expect(resolveChromiumExecutable(chromium, { env, exists: () => true })).toBe('/custom/chrome');
  });

  test('falls back to the playwright registry path when present', () => {
    const chromium = { executablePath: () => '/reg/chrome' };
    expect(resolveChromiumExecutable(chromium, { exists: () => true, readdir: () => [] })).toBe('/reg/chrome');
  });

  test('scans the cache when the registry path is stale', () => {
    const chromium = { executablePath: () => '/stale/chrome' };
    const exists = (p) => p !== '/stale/chrome';
    const readdir = () => ['chromium-1248'];
    expect(resolveChromiumExecutable(chromium, { env: {}, home: '/h', exists, readdir })).toBe(
      '/h/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
    );
  });
});
describe('mermaidDocUrl', () => {
  test('points at the hash route for the doc', () => {
    expect(mermaidDocUrl(5173, 'perf-mermaid')).toBe('http://127.0.0.1:5173/#/perf-mermaid');
  });
});

describe('bytesToMB', () => {
  test('divides by 1024^2', () => {
    expect(bytesToMB(1048576)).toBe(1);
  });
});

describe('shapeRendererResult', () => {
  test('converts heap bytes and keeps the rest', () => {
    expect(
      shapeRendererResult({
        heap: { usedJSHeapSize: 41943040, totalJSHeapSize: 83886080 },
        domNodes: 1234,
        scriptDurationMs: 42,
        mermaidOpenMs: 1500,
      }),
    ).toEqual({
      jsHeapUsedMB: 40,
      jsHeapTotalMB: 80,
      domNodesMermaidDoc: 1234,
      scriptDurationMs: 42,
      mermaidOpenMs: 1500,
    });
  });

  test('nulls heap when performance.memory is unavailable', () => {
    const shaped = shapeRendererResult({ heap: null, domNodes: 10, scriptDurationMs: 1, mermaidOpenMs: 2 });
    expect(shaped.jsHeapUsedMB).toBeNull();
    expect(shaped.jsHeapTotalMB).toBeNull();
    expect(shaped.domNodesMermaidDoc).toBe(10);
  });
});
