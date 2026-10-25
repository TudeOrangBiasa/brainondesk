import { createHash } from 'node:crypto';
import type { BigIntStats } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { AsyncSubscription, Event, SubscribeCallback, subscribe } from '@parcel/watcher';
import { errnoCode } from './http/handler-utils.ts';
import { getLogger } from './logger.ts';
import { acquireParcelHub, findCoveringParcelHub } from './parcel-hub.ts';
import { classifyParcelNotification } from './parcel-recovery.ts';
import { isRacyStat, sampleWallClockNs, statSignature } from './stat-signature.ts';

const RECONCILE_DEBOUNCE_MS = 100;
const CONFIRM_DELAY_MS = 200;
const FALLBACK_ACTIVE_MS = 5000;
const FALLBACK_IDLE_MS = 60_000;
const QUIET_ROUNDS_TO_IDLE = 2;

type PathEvent = 'add' | 'change' | 'unlink';

type ParcelSubscribe = typeof subscribe;

interface ParcelBackend {
  subscribe: ParcelSubscribe;
}

async function acquireLeafSubscription(
  parcel: ParcelBackend,
  dir: string,
  parcelCallback: SubscribeCallback,
  onSubscriptionError: SubscribeCallback,
): Promise<{ subscription: AsyncSubscription | null; release: () => Promise<void> }> {
  const hub = findCoveringParcelHub(parcel, dir) ?? acquireParcelHub(parcel, dir);
  const removeWatcher = hub.addWatcher({ onBatch: parcelCallback, onSubscriptionError });
  const subscription = await hub.nativeSubscription;
  let released = false;
  return {
    subscription,
    release: async () => {
      if (released) return;
      released = true;
      removeWatcher();
      await hub.release();
    },
  };
}

interface EventLeafWatcherOptions {
  listPaths: () => Promise<ReadonlyArray<string>>;
  onEvent: (event: PathEvent, path: string) => void;
  onError: (err: unknown, path?: string) => void;
}

interface Observation {
  readonly size: bigint;
  readonly signature: string;
  readonly racy: boolean;
  readonly digest: string | undefined;
}

const readsAsAbsent = (err: unknown): boolean => {
  const code = errnoCode(err);
  return code === 'ENOENT' || code === 'ENOTDIR';
};

const unchanged = (known: Observation, observed: Observation): boolean =>
  known.signature === observed.signature && (!known.racy || known.digest === observed.digest);

const retained = (observation: Observation): Observation =>
  observation.racy ? observation : { ...observation, digest: undefined };

async function fileStats(path: string): Promise<BigIntStats | undefined> {
  let stats: BigIntStats;
  try {
    stats = await stat(path, { bigint: true });
  } catch (err) {
    if (readsAsAbsent(err)) return undefined;
    throw err;
  }
  return stats.isFile() ? stats : undefined;
}

async function contentDigest(path: string): Promise<string | undefined> {
  try {
    return createHash('sha256')
      .update(await readFile(path))
      .digest('hex');
  } catch (err) {
    if (readsAsAbsent(err)) return undefined;
    throw err;
  }
}

async function observe(
  path: string,
  known: Observation | undefined,
  isClosed: () => boolean,
): Promise<Observation | undefined> {
  const sampledAtNs = sampleWallClockNs();
  const first = await fileStats(path);
  if (first === undefined) return undefined;
  if (!known?.racy && !isRacyStat(first, sampledAtNs)) {
    return { size: first.size, signature: statSignature(first), racy: false, digest: undefined };
  }
  if (isClosed()) return undefined;
  const digest = await contentDigest(path);
  if (digest === undefined || isClosed()) return undefined;
  const second = await fileStats(path);
  if (second === undefined) return undefined;
  return {
    size: second.size,
    signature: statSignature(second),
    racy: isRacyStat(second, sampledAtNs),
    digest,
  };
}

export async function startEventLeafWatcher({
  listPaths,
  onEvent,
  onError,
}: EventLeafWatcherOptions): Promise<() => Promise<void>> {
  const log = getLogger('event-leaf-watcher');
  const failingCodes = new Map<string, string | undefined>();
  const reference = new Map<string, Observation>();
  const pendingSizes = new Map<string, bigint>();
  const subscriptions = new Map<string, { release: () => Promise<void> }>();
  let closed = false;
  let parcelEventsSinceReconcile = false;
  let quietRounds = 0;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let confirmTimer: ReturnType<typeof setTimeout> | null = null;
  let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  let parcelModule: typeof import('@parcel/watcher') | null = null;

  const report = (err: unknown, path?: string): void => {
    if (closed) return;
    try {
      onError(err, path);
    } catch (thrown) {
      try {
        log.error({ err, error: thrown, path }, 'onError threw while reporting a watcher error');
      } catch {}
    }
  };

  const dispatchParcelBatch = (events: Event[]): void => {
    parcelEventsSinceReconcile = true;
    for (const [leaf] of pendingSizes) {
      if (events.some((event) => event.path === leaf || event.path.startsWith(`${leaf}/`))) {
        pendingSizes.delete(leaf);
      }
    }
    scheduleSoon(RECONCILE_DEBOUNCE_MS);
  };

  const emit = (event: PathEvent, path: string): void => {
    if (closed) return;
    onEvent(event, path);
  };

  const parcelCallback: SubscribeCallback = (_err, events) => {
    if (closed) return;
    dispatchParcelBatch(events);
  };

  const parcelSubscriptionError: SubscribeCallback = (err, events) => {
    if (closed) return;
    const notification = classifyParcelNotification(err, events);
    if (notification.kind !== 'error') {
      dispatchParcelBatch(notification.events);
      return;
    }
    log.warn({ err: notification.error }, '[event-leaf-watcher] parcel subscription error');
    parcelEventsSinceReconcile = true;
    scheduleSoon(RECONCILE_DEBOUNCE_MS);
  };

  const ensureSubscriptions = async (): Promise<void> => {
    if (parcelModule === null || closed) return;
    const parcel = parcelModule;
    const dirs = new Set(Array.from(await listPaths(), (path) => dirname(path)));
    await Promise.all(
      Array.from(dirs, async (dir) => {
        if (subscriptions.has(dir)) return;
        if (parcel !== parcelModule || closed) return;
        const resolved = resolve(dir);
        const { subscription, release } = await acquireLeafSubscription(
          parcel,
          resolved,
          parcelCallback,
          parcelSubscriptionError,
        );
        if (parcel !== parcelModule || closed) {
          await release();
          return;
        }
        if (subscription === null) {
          await release();
          log.warn(
            { dir },
            '[event-leaf-watcher] @parcel/watcher subscribe failed; retrying on a later sweep',
          );
          return;
        }
        subscriptions.set(dir, { release });
      }),
    );
  };

  const sampleAll = async (
    kept: ReadonlyMap<string, Observation>,
  ): Promise<{ failed: boolean; observed: Map<string, Observation> }> => {
    let failed = false;
    const listed = new Set(await listPaths());
    for (const path of failingCodes.keys()) {
      if (!listed.has(path)) failingCodes.delete(path);
    }
    const observed = new Map<string, Observation>();
    await Promise.all(
      Array.from(listed, async (path) => {
        let observation: Observation | undefined;
        try {
          observation = await observe(path, kept.get(path), () => closed);
        } catch (err) {
          failed = true;
          const code = errnoCode(err);
          if (!failingCodes.has(path) || failingCodes.get(path) !== code) {
            failingCodes.set(path, code);
            report(err, path);
          }
          const last = kept.get(path);
          if (last) observed.set(path, last);
          return;
        }
        failingCodes.delete(path);
        if (observation) observed.set(path, observation);
      }),
    );
    return { failed, observed };
  };

  const sampleCounted = async (): Promise<{ failed: boolean; emitted: number }> => {
    const { failed, observed } = await sampleAll(reference);
    let emitted = 0;
    for (const [path, observation] of observed) {
      const known = reference.get(path);
      if (known !== undefined && unchanged(known, observation)) {
        pendingSizes.delete(path);
        if (known.racy) reference.set(path, retained(observation));
      } else if (pendingSizes.get(path) === observation.size) {
        pendingSizes.delete(path);
        reference.set(path, retained(observation));
        emitted += 1;
        emit(known ? 'change' : 'add', path);
      } else {
        pendingSizes.set(path, observation.size);
      }
    }
    for (const path of reference.keys()) {
      if (observed.has(path)) continue;
      reference.delete(path);
      emitted += 1;
      emit('unlink', path);
    }
    for (const path of pendingSizes.keys()) {
      if (!observed.has(path)) pendingSizes.delete(path);
    }
    return { failed, emitted };
  };

  let reconcileRunning = false;
  let reconcileQueued = false;
  let reconcileTail: Promise<void> = Promise.resolve();

  const runReconcile = async (): Promise<void> => {
    let failed = false;
    let emitted = 0;
    const hadParcelEvents = parcelEventsSinceReconcile;
    parcelEventsSinceReconcile = false;
    try {
      const result = await sampleCounted();
      failed = result.failed;
      emitted = result.emitted;
    } catch (err) {
      failed = true;
      report(err);
    }
    if (closed) return;
    if (failed || emitted > 0 || hadParcelEvents) {
      quietRounds = 0;
    } else {
      quietRounds += 1;
    }
    if (pendingSizes.size > 0) scheduleSoon(CONFIRM_DELAY_MS);
    scheduleFallback();
    await ensureSubscriptions();
  };

  const requestReconcile = (): void => {
    if (closed) return;
    if (reconcileRunning) {
      reconcileQueued = true;
      return;
    }
    reconcileRunning = true;
    reconcileTail = reconcileTail.then(async () => {
      try {
        do {
          reconcileQueued = false;
          await runReconcile();
        } while (reconcileQueued && !closed);
      } catch (err) {
        report(err);
      } finally {
        reconcileRunning = false;
      }
    });
  };

  function scheduleSoon(delayMs: number): void {
    if (closed || debounceTimer !== null) return;
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      requestReconcile();
    }, delayMs);
    debounceTimer.unref?.();
  }

  function scheduleFallback(): void {
    if (closed || fallbackTimer !== null) return;
    const delay = quietRounds >= QUIET_ROUNDS_TO_IDLE ? FALLBACK_IDLE_MS : FALLBACK_ACTIVE_MS;
    fallbackTimer = setTimeout(() => {
      fallbackTimer = null;
      requestReconcile();
    }, delay);
    fallbackTimer.unref?.();
  }

  try {
    parcelModule = await import('@parcel/watcher');
  } catch (err) {
    log.debug(
      { err: err instanceof Error ? err.message : String(err) },
      '[event-leaf-watcher] @parcel/watcher import failed; relying on the fallback sweep',
    );
  }

  try {
    const { observed } = await sampleAll(reference);
    for (const [path, observation] of observed) reference.set(path, retained(observation));
  } catch (err) {
    report(err);
  }
  if (!closed) {
    await ensureSubscriptions();
    const delay = FALLBACK_ACTIVE_MS;
    fallbackTimer = setTimeout(() => {
      fallbackTimer = null;
      requestReconcile();
    }, delay);
    fallbackTimer.unref?.();
  }

  return async () => {
    if (closed) return;
    closed = true;
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    if (confirmTimer !== null) {
      clearTimeout(confirmTimer);
      confirmTimer = null;
    }
    if (fallbackTimer !== null) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
    const held = Array.from(subscriptions.values());
    subscriptions.clear();
    void Promise.all(held.map((entry) => entry.release()));
  };
}
