import { describe, expect, it } from 'vitest';
import type { RunningSlidesDeck, SlidesDeckWindow } from './slides-registry.ts';
import { createSlidesDeckRegistry } from './slides-registry.ts';

function closableWindow(id: number) {
  let destroyed = false;
  const closed: Array<() => void> = [];
  const closes: number[] = [];
  const window = {
    id,
    isDestroyed: () => destroyed,
    close: () => {
      closes.push(id);
      for (const cb of closed) cb();
    },
    on: (event: string, cb: () => void) => {
      if (event === 'closed') closed.push(cb);
    },
    focus: () => {},
  } as unknown as SlidesDeckWindow;
  return { window, closes, destroy: () => (destroyed = true) };
}

function deckEntry(
  docPath: string,
  port: number,
  ownerId: number,
  window: SlidesDeckWindow,
): RunningSlidesDeck {
  return {
    docPath,
    ownerId,
    port,
    process: { onExit: () => {}, signal: () => Promise.resolve(), isAlive: () => true, pid: port },
    window,
  };
}

describe('one active deck per owner', () => {
  it('closes the owner sibling while leaving other owners alone', () => {
    const registry = createSlidesDeckRegistry();
    const a = closableWindow(1);
    const b = closableWindow(2);
    const other = closableWindow(3);
    registry.register(deckEntry('/decks/a.md', 4300, 7, a.window));
    registry.register(deckEntry('/decks/b.md', 4301, 7, b.window));
    registry.register(deckEntry('/decks/other.md', 4302, 9, other.window));

    registry.reapOwnerExcept(7, '/decks/b.md');

    expect(a.closes).toEqual([1]);
    expect(b.closes).toEqual([]);
    expect(other.closes).toEqual([]);
    expect(registry.takeReapReason('/decks/a.md')).toBe('replaced');
  });

  it('skips windows that are already destroyed', () => {
    const registry = createSlidesDeckRegistry();
    const gone = closableWindow(1);
    gone.destroy();
    registry.register(deckEntry('/decks/a.md', 4300, 7, gone.window));

    registry.reapOwnerExcept(7, '/decks/b.md');

    expect(gone.closes).toEqual([]);
    expect(registry.takeReapReason('/decks/a.md')).toBeUndefined();
  });
});

describe('idle sweep', () => {
  function virtualClock() {
    let now = 1_000_000;
    return { now: () => now, advance: (ms: number) => (now += ms) };
  }

  function sweepWindow(id: number, focused: boolean) {
    const closes: number[] = [];
    const window = {
      id,
      isDestroyed: () => false,
      isFocused: () => focused,
      close: () => closes.push(id),
      on: () => {},
      focus: () => {},
    } as unknown as SlidesDeckWindow;
    return { window, closes };
  }

  function manualTimers() {
    let next: (() => void) | undefined;
    return {
      setTimeout: (cb: () => void) => {
        next = cb;
        return 1;
      },
      clearTimeout: () => {
        next = undefined;
      },
      runNext: () => {
        const tick = next;
        tick?.();
      },
    };
  }

  it('closes an unfocused deck that outlasts the idle budget', () => {
    const clock = virtualClock();
    const registry = createSlidesDeckRegistry(clock);
    const timers = manualTimers();
    const stale = sweepWindow(1, false);
    registry.register(deckEntry('/decks/stale.md', 4300, 7, stale.window));
    const stop = registry.startIdleSweep({ ...timers, idleMs: 60_000, sweepMs: 1_000 });

    clock.advance(61_000);
    timers.runNext();

    expect(stale.closes).toEqual([1]);
    expect(registry.takeReapReason('/decks/stale.md')).toBe('idle');
    stop();
  });

  it('leaves a focused deck alone and refreshes its activity', () => {
    const clock = virtualClock();
    const registry = createSlidesDeckRegistry(clock);
    const timers = manualTimers();
    const live = sweepWindow(1, true);
    registry.register(deckEntry('/decks/live.md', 4300, 7, live.window));
    const stop = registry.startIdleSweep({ ...timers, idleMs: 60_000, sweepMs: 1_000 });

    clock.advance(120_000);
    timers.runNext();

    expect(live.closes).toEqual([]);
    expect(registry.takeReapReason('/decks/live.md')).toBeUndefined();
    stop();
  });

  it('noteUsed rescues a deck from the next sweep', () => {
    const clock = virtualClock();
    const registry = createSlidesDeckRegistry(clock);
    const timers = manualTimers();
    const deck = sweepWindow(1, false);
    registry.register(deckEntry('/decks/talk.md', 4300, 7, deck.window));
    const stop = registry.startIdleSweep({ ...timers, idleMs: 60_000, sweepMs: 1_000 });

    clock.advance(59_000);
    registry.noteUsed('/decks/talk.md');
    clock.advance(59_000);
    timers.runNext();

    expect(deck.closes).toEqual([]);
    stop();
  });

  it('stops scheduling after the returned stop runs', () => {
    const clock = virtualClock();
    const registry = createSlidesDeckRegistry(clock);
    const timers = manualTimers();
    const deck = sweepWindow(1, false);
    registry.register(deckEntry('/decks/talk.md', 4300, 7, deck.window));

    const stop = registry.startIdleSweep({ ...timers, idleMs: 1, sweepMs: 1_000 });
    stop();
    timers.runNext();

    expect(deck.closes).toEqual([]);
  });
});

describe('slides-reaped quit logging', () => {
  it('logs one line per live process with reason quit', async () => {
    const registry = createSlidesDeckRegistry();
    const lines: unknown[][] = [];
    const original = console.warn;
    console.warn = (...args: unknown[]) => {
      lines.push(args);
    };
    try {
      registry.register(deckEntry('/decks/a.md', 3001, 7, closableWindow(1).window));
      const signals: Array<'SIGTERM' | 'SIGKILL'> = [];
      registry.trackSpawned('/decks/b.md', {
        onExit: () => {},
        signal: (sig) => {
          signals.push(sig);
          return Promise.resolve();
        },
        isAlive: () => true,
        pid: 4242,
      });

      await registry.reapAll();

      expect(signals).toEqual(['SIGKILL']);
      expect(lines.map(([line]) => JSON.parse(String(line)))).toEqual([
        { event: 'slides-reaped', reason: 'quit', port: 3001 },
        { event: 'slides-reaped', reason: 'quit', pid: 4242 },
      ]);
    } finally {
      console.warn = original;
    }
  });
});
