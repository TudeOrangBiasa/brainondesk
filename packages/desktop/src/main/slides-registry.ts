import type { OkSlidesOpenResult } from '../shared/ipc-channels.ts';
import type { SlidevProcess } from './slidev-server.ts';
import type { BrowserWindowLike } from './window-manager.ts';

export type SlidesDeckWindow = BrowserWindowLike & { readonly id: number };

export interface RunningSlidesDeck {
  readonly docPath: string;
  readonly ownerId: number;
  readonly port: number;
  readonly process: SlidevProcess;
  readonly window: SlidesDeckWindow;
}

export type SlidesReapReason = 'window-closed' | 'replaced' | 'idle' | 'open-failed' | 'quit';

export type SlidesPreCloseReapReason = Extract<SlidesReapReason, 'replaced' | 'idle'>;

export interface SlidesRegistryClock {
  now(): number;
}

export interface SlidesIdleSweepDeps {
  setTimeout(cb: () => void, ms: number): SlidesIdleTimer;
  clearTimeout(handle: SlidesIdleTimer | undefined): void;
  idleMs?: number;
  sweepMs?: number;
}

export type SlidesIdleTimer = ReturnType<typeof setTimeout> | number;

export const SLIDES_IDLE_MS = 5 * 60_000;

const SLIDES_SWEEP_MS = 60_000;

export interface SlidesDeckRegistry {
  get(docPath: string): RunningSlidesDeck | undefined;
  register(deck: RunningSlidesDeck): void;
  unregister(docPath: string): void;
  reapOwnerExcept(ownerId: number, exceptDocPath: string): void;
  noteUsed(docPath: string): void;
  takeReapReason(docPath: string): SlidesPreCloseReapReason | undefined;
  startIdleSweep(deps: SlidesIdleSweepDeps): () => void;
  reapAll(): Promise<void>;
  size(): number;
  getOpenInFlight(docPath: string): Promise<OkSlidesOpenResult> | undefined;
  setOpenInFlight(docPath: string, attempt: Promise<OkSlidesOpenResult>): void;
  clearOpenInFlight(docPath: string): void;
  trackSpawned(docPath: string, process: SlidevProcess): void;
}

export function createSlidesDeckRegistry(
  clock: SlidesRegistryClock = { now: () => Date.now() },
): SlidesDeckRegistry {
  const decks = new Map<string, RunningSlidesDeck>();
  const opening = new Map<string, Promise<OkSlidesOpenResult>>();
  const spawned = new Map<string, Set<SlidevProcess>>();
  const lastActive = new Map<string, number>();
  const reapReasons = new Map<string, SlidesPreCloseReapReason>();
  return {
    get: (docPath) => decks.get(docPath),
    register: (deck) => {
      decks.set(deck.docPath, deck);
      lastActive.set(deck.docPath, clock.now());
    },
    unregister: (docPath) => {
      decks.delete(docPath);
      lastActive.delete(docPath);
      reapReasons.delete(docPath);
    },
    reapOwnerExcept: (ownerId, exceptDocPath) => {
      for (const deck of decks.values()) {
        if (deck.ownerId !== ownerId || deck.docPath === exceptDocPath) continue;
        if (deck.window.isDestroyed?.() === true) continue;
        reapReasons.set(deck.docPath, 'replaced');
        deck.window.close?.();
      }
    },
    noteUsed: (docPath) => {
      if (decks.has(docPath)) lastActive.set(docPath, clock.now());
    },
    takeReapReason: (docPath) => {
      const reason = reapReasons.get(docPath);
      reapReasons.delete(docPath);
      return reason;
    },
    startIdleSweep: (deps) => {
      const idleMs = deps.idleMs ?? SLIDES_IDLE_MS;
      const sweepMs = deps.sweepMs ?? SLIDES_SWEEP_MS;
      let stopped = false;
      let timer: SlidesIdleTimer | undefined;
      const tick = (): void => {
        if (stopped) return;
        const now = clock.now();
        for (const deck of decks.values()) {
          if (deck.window.isDestroyed?.() === true) continue;
          if (deck.window.isFocused?.() === true) {
            lastActive.set(deck.docPath, now);
            continue;
          }
          const activeAt = lastActive.get(deck.docPath) ?? now;
          if (now - activeAt >= idleMs) {
            reapReasons.set(deck.docPath, 'idle');
            deck.window.close?.();
          }
        }
        timer = deps.setTimeout(tick, sweepMs);
      };
      timer = deps.setTimeout(tick, sweepMs);
      return () => {
        stopped = true;
        deps.clearTimeout(timer);
      };
    },
    reapAll: async () => {
      const processes = new Set<SlidevProcess>();
      const reaped: Array<{ port: number } | { pid: number | undefined }> = [];
      for (const deck of decks.values()) {
        if (deck.process.isAlive()) {
          processes.add(deck.process);
          reaped.push({ port: deck.port });
        }
      }
      for (const spawnedProcesses of spawned.values()) {
        for (const process of spawnedProcesses) {
          if (process.isAlive() && !processes.has(process)) {
            processes.add(process);
            reaped.push({ pid: process.pid });
          }
        }
      }
      decks.clear();
      spawned.clear();
      opening.clear();
      lastActive.clear();
      reapReasons.clear();
      for (const entry of reaped) {
        console.warn(JSON.stringify({ event: 'slides-reaped', reason: 'quit', ...entry }));
      }
      await Promise.allSettled(Array.from(processes, (process) => process.signal('SIGKILL')));
    },
    size: () => decks.size,
    getOpenInFlight: (docPath) => opening.get(docPath),
    setOpenInFlight: (docPath, attempt) => {
      opening.set(docPath, attempt);
    },
    clearOpenInFlight: (docPath) => {
      opening.delete(docPath);
    },
    trackSpawned: (docPath, process) => {
      const processes = spawned.get(docPath) ?? new Set<SlidevProcess>();
      processes.add(process);
      spawned.set(docPath, processes);
      const forget = () => {
        processes.delete(process);
        if (processes.size === 0 && spawned.get(docPath) === processes) {
          spawned.delete(docPath);
        }
      };
      process.onExit(forget);
      if (!process.isAlive()) forget();
    },
  };
}
