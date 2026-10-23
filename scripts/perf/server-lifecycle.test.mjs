import { describe, expect, test } from 'vitest';
import { isolatedHomeEnv, runtimeCommand, runtimeStartArgs } from './server-lifecycle.mjs';

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
