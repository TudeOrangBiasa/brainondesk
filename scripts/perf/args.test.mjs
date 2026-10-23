import { describe, expect, test } from 'vitest';
import { defaultOutDir, parseBaselineArgs, runtimesFor } from './args.mjs';

describe('parseBaselineArgs', () => {
  test('defaults match the ticket contract', () => {
    expect(parseBaselineArgs([])).toMatchObject({
      runtime: 'both',
      runs: 1,
      idleSeconds: 60,
      noteCount: 300,
      diagramCount: 20,
      seed: 68,
      multiVault: false,
      outDir: null,
      startupTimeoutSeconds: 30,
      keepTmp: false,
      skipRenderer: false,
      skipBundle: false,
      help: false,
    });
  });

  test('parses every flag', () => {
    const opts = parseBaselineArgs([
      '--runtime', 'node',
      '--runs', '3',
      '--idle-seconds', '10',
      '--notes', '12',
      '--diagrams', '2',
      '--seed', '9',
      '--multi-vault',
      '--out', '/tmp/x',
      '--startup-timeout', '45',
      '--keep-tmp',
      '--skip-renderer',
      '--skip-bundle',
    ]);
    expect(opts).toMatchObject({
      runtime: 'node',
      runs: 3,
      idleSeconds: 10,
      noteCount: 12,
      diagramCount: 2,
      seed: 9,
      multiVault: true,
      outDir: '/tmp/x',
      startupTimeoutSeconds: 45,
      keepTmp: true,
      skipRenderer: true,
      skipBundle: true,
    });
  });

  test('accepts --runtime=bun and --help', () => {
    expect(parseBaselineArgs(['--runtime=bun'])).toMatchObject({ runtime: 'bun' });
    expect(parseBaselineArgs(['--help'])).toMatchObject({ help: true });
    expect(parseBaselineArgs(['-h'])).toMatchObject({ help: true });
  });

  test('rejects bad runtimes, bad numbers, and unknown flags', () => {
    expect(() => parseBaselineArgs(['--runtime', 'deno'])).toThrow();
    expect(() => parseBaselineArgs(['--runtime=deno'])).toThrow();
    expect(() => parseBaselineArgs(['--runs', '0'])).toThrow();
    expect(() => parseBaselineArgs(['--runs', 'x'])).toThrow();
    expect(() => parseBaselineArgs(['--idle-seconds', '0'])).toThrow();
    expect(() => parseBaselineArgs(['--nope'])).toThrow();
    expect(() => parseBaselineArgs(['--out'])).toThrow();
  });
});

describe('runtimesFor', () => {
  test('both expands to node+bun', () => {
    expect(runtimesFor({ runtime: 'both' })).toEqual(['node', 'bun']);
    expect(runtimesFor({ runtime: 'node' })).toEqual(['node']);
    expect(runtimesFor({ runtime: 'bun' })).toEqual(['bun']);
  });
});

describe('defaultOutDir', () => {
  test('lands under the repo root', () => {
    expect(defaultOutDir('/repo')).toBe('/repo/perf-baseline');
  });
});
