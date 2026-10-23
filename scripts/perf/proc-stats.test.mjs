import { describe, expect, test } from 'vitest';
import {
  cpuSecondsBetween,
  median,
  parseServerLock,
  parseSmapsRollup,
  procStatCpuTicks,
} from './proc-stats.mjs';

describe('parseSmapsRollup', () => {
  test('reads Rss and Pss in kB', () => {
    const text = [
      'Rss:              273412 kB',
      'Pss:              268901 kB',
      'Shared_Clean:      12340 kB',
    ].join('\n');
    expect(parseSmapsRollup(text)).toEqual({ rssKB: 273412, pssKB: 268901 });
  });

  test('missing keys stay null', () => {
    expect(parseSmapsRollup('Shared_Clean: 1 kB\n')).toEqual({ rssKB: null, pssKB: null });
  });

  test('first occurrence wins', () => {
    const text = 'Rss: 10 kB\nRss: 20 kB\nPss: 5 kB\n';
    expect(parseSmapsRollup(text)).toEqual({ rssKB: 10, pssKB: 5 });
  });
});

describe('procStatCpuTicks', () => {
  test('parses utime/stime past a comm with spaces and parens', () => {
    const fields = ['1234', '(my proc (x))', 'S'];
    for (let i = 3; i < 52; i += 1) fields.push('0');
    fields[13] = '120';
    fields[14] = '30';
    expect(procStatCpuTicks(`${fields.join(' ')}\n`)).toEqual({ utime: 120, stime: 30 });
  });

  test('returns null on garbage', () => {
    expect(procStatCpuTicks('nope\n')).toBeNull();
  });
});

describe('cpuSecondsBetween', () => {
  test('sums user+sys deltas over the tick rate', () => {
    expect(cpuSecondsBetween({ utime: 100, stime: 20 }, { utime: 160, stime: 40 }, 100)).toBeCloseTo(0.8, 9);
  });
});

describe('parseServerLock', () => {
  test('accepts a live lock with pid+port', () => {
    expect(parseServerLock('{"pid":4242,"port":5173,"hostname":"h"}')).toEqual({ pid: 4242, port: 5173 });
  });

  test('rejects port 0, missing pid, and corrupt JSON', () => {
    expect(parseServerLock('{"pid":1,"port":0}')).toBeNull();
    expect(parseServerLock('{"port":3000}')).toBeNull();
    expect(parseServerLock('not-json{{{')).toBeNull();
    expect(parseServerLock('[]')).toBeNull();
  });
});

describe('median', () => {
  test('odd, even, and empty inputs', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});
