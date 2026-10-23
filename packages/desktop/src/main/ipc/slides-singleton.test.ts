import { describe, expect, it, vi } from 'vitest';
import { createSlidesDeckRegistry, type SlidesDeckWindow } from '../slides-registry.ts';
import type { SlidevProcess, StartSlidevDeps } from '../slidev-server.ts';
import { handleSlidesOpen } from './slides.ts';

const DECK_A = '/decks/a.md';
const DECK_B = '/decks/b.md';

function fakeSlidevProcess(): SlidevProcess {
  return {
    onExit: () => {},
    signal: () => Promise.resolve(),
    isAlive: () => true,
    pid: 4242,
  };
}

function readyStartDeps(port: number): StartSlidevDeps {
  return {
    findFreePort: () => Promise.resolve(port),
    spawnSlidev: () => fakeSlidevProcess(),
    probeReady: () => Promise.resolve({ reachable: true, hasVersionMeta: true }),
    now: () => 0,
    delay: () => Promise.resolve(),
  };
}

function closableWindow(id: number) {
  const closes: number[] = [];
  const window = {
    id,
    isDestroyed: () => false,
    close: () => closes.push(id),
    on: () => {},
    focus: () => {},
  } as unknown as SlidesDeckWindow;
  return { window, closes };
}

describe('one Slidev per owner window', () => {
  it('closes the owner sibling when a different deck opens', async () => {
    const registry = createSlidesDeckRegistry();
    const sibling = closableWindow(1);
    registry.register({
      docPath: DECK_A,
      ownerId: 7,
      port: 5200,
      process: fakeSlidevProcess(),
      window: sibling.window,
    });
    const opened: string[] = [];

    const result = await handleSlidesOpen(DECK_B, {
      registry,
      ownerId: 7,
      startDeps: readyStartDeps(5300),
      openWindow: async (deck) => {
        opened.push(deck.docPath);
        registry.register({ ...deck, window: closableWindow(2).window });
        return { shown: true };
      },
      focusWindow: () => {},
      recordOpenAttempt: () => {},
    });

    expect(result).toEqual({ kind: 'open', ok: true });
    expect(opened).toEqual([DECK_B]);
    expect(sibling.closes).toEqual([1]);
    expect(registry.takeReapReason(DECK_A)).toBe('replaced');
  });

  it('leaves decks owned by other windows alone', async () => {
    const registry = createSlidesDeckRegistry();
    const other = closableWindow(9);
    registry.register({
      docPath: DECK_A,
      ownerId: 9,
      port: 5200,
      process: fakeSlidevProcess(),
      window: other.window,
    });

    await handleSlidesOpen(DECK_B, {
      registry,
      ownerId: 7,
      startDeps: readyStartDeps(5300),
      openWindow: async (deck) => {
        registry.register({ ...deck, window: closableWindow(2).window });
        return { shown: true };
      },
      focusWindow: () => {},
      recordOpenAttempt: () => {},
    });

    expect(other.closes).toEqual([]);
    expect(registry.takeReapReason(DECK_A)).toBeUndefined();
  });

  it('does not reap the owner sibling when the new start fails', async () => {
    const registry = createSlidesDeckRegistry();
    const sibling = closableWindow(1);
    registry.register({
      docPath: DECK_A,
      ownerId: 7,
      port: 5200,
      process: fakeSlidevProcess(),
      window: sibling.window,
    });
    const reapOwnerExcept = vi.spyOn(registry, 'reapOwnerExcept');

    const result = await handleSlidesOpen(DECK_B, {
      registry,
      ownerId: 7,
      startDeps: {
        findFreePort: () => Promise.resolve(5300),
        spawnSlidev: () => fakeSlidevProcess(),
        probeReady: () => Promise.resolve({ reachable: false }),
        now: () => 99_999,
        delay: () => Promise.resolve(),
        timeoutMs: -1,
      },
      openWindow: () => {
        throw new Error('a failed start must not open a window');
      },
      focusWindow: () => {},
      recordOpenAttempt: () => {},
    });

    expect(result).toEqual({ kind: 'open', ok: false, reason: 'timeout' });
    expect(reapOwnerExcept).toHaveBeenCalledWith(7, DECK_B);
    expect(sibling.closes).toEqual([1]);
    reapOwnerExcept.mockRestore();
  });
});
