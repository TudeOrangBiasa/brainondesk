import { describe, expect, test, vi } from 'vitest';
import { createSlidesDeckRegistry, type SlidesDeckWindow } from './slides-registry.ts';
import { createSlidesWindow } from './slides-window.ts';

function makeWindow(id: number, port: number) {
  const closedHandlers: Array<() => void> = [];
  const window = {
    id,
    show: vi.fn(() => {}),
    close: vi.fn(() => {
      for (const cb of closedHandlers) cb();
    }),
    destroy: vi.fn(() => {
      for (const cb of closedHandlers) cb();
    }),
    on: (event: string, cb: () => void) => {
      if (event === 'closed') closedHandlers.push(cb);
    },
    once: () => {},
    webContents: {
      executeJavaScript: vi.fn(async () => true),
      setWindowOpenHandler: () => {},
      on: () => {},
    },
    loadFile: vi.fn(async () => {}),
    loadURL: vi.fn(async () => {}),
  } as unknown as SlidesDeckWindow;
  return { window, port };
}

function makeDeck(docPath: string, port: number) {
  let alive = true;
  return {
    docPath,
    ownerId: 7,
    port,
    process: {
      onExit: () => {},
      signal: () => {
        alive = false;
        return Promise.resolve();
      },
      isAlive: () => alive,
      pid: 4321,
    },
  };
}

function virtualTerminateClock() {
  let clock = 0;
  return {
    now: () => clock,
    sleep: (ms: number) => {
      clock += ms;
      return Promise.resolve();
    },
    graceMs: 1,
    pollMs: 1,
  };
}

function reapedLines(spy: { mock: { calls: unknown[][] } }) {
  return spy.mock.calls
    .map(([line]) => {
      try {
        return JSON.parse(String(line)) as Record<string, unknown>;
      } catch {
        return null;
      }
    })
    .filter((line) => line !== null && line.event === 'slides-reaped');
}

describe('slides-reaped window lifecycle logging', () => {
  test('closing the window logs window-closed with the port', async () => {
    const fake = makeWindow(80_001, 4300);
    const registry = createSlidesDeckRegistry();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await createSlidesWindow({
        createWindow: () => fake.window,
        registry,
        deck: makeDeck('/decks/talk.md', 4300),
        terminateClock: virtualTerminateClock(),
      });
      warnSpy.mockClear();
      (fake.window.close as unknown as () => void)();
      for (let i = 0; i < 5; i += 1) await Promise.resolve();

      expect(reapedLines(warnSpy)).toEqual([
        { event: 'slides-reaped', reason: 'window-closed', port: 4300 },
      ]);
    } finally {
      warnSpy.mockRestore();
    }
  });

  test('a replaced deck logs the pre-close reason instead of window-closed', async () => {
    const fake = makeWindow(80_001, 4300);
    const registry = createSlidesDeckRegistry();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await createSlidesWindow({
        createWindow: () => fake.window,
        registry,
        deck: makeDeck('/decks/talk.md', 4300),
        terminateClock: virtualTerminateClock(),
      });
      warnSpy.mockClear();
      registry.reapOwnerExcept(7, '/decks/other.md');
      for (let i = 0; i < 5; i += 1) await Promise.resolve();

      expect(reapedLines(warnSpy)).toEqual([
        { event: 'slides-reaped', reason: 'replaced', port: 4300 },
      ]);
    } finally {
      warnSpy.mockRestore();
    }
  });

  test('a failed open logs open-failed and never the path', async () => {
    const fake = makeWindow(80_001, 4300);
    (fake.window as unknown as { loadURL: () => Promise<void> }).loadURL = () =>
      Promise.reject(new Error('slidev boom'));
    const registry = createSlidesDeckRegistry();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await expect(
        createSlidesWindow({
          createWindow: () => fake.window,
          registry,
          deck: makeDeck('/decks/talk.md', 4300),
          terminateClock: virtualTerminateClock(),
        }),
      ).resolves.toEqual({ shown: false, reason: 'load-failed' });

      expect(reapedLines(warnSpy)).toEqual([
        { event: 'slides-reaped', reason: 'open-failed', port: 4300 },
      ]);
      expect(JSON.stringify(reapedLines(warnSpy))).not.toContain('/decks/talk.md');
    } finally {
      warnSpy.mockRestore();
    }
  });
});
