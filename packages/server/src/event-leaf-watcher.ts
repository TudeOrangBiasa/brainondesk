import { createHash } from 'node:crypto';
import type { BigIntStats } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { AsyncSubscription, Event, SubscribeCallback, subscribe } from '@parcel/watcher';
import { errnoCode } from './http/handler-utils.ts';
import { getLogger } from './logger.ts';
import { classifyParcelNotification } from './parcel-recovery.ts';
import { subscribeParcel } from './parcel-subscription.ts';
import { isRacyStat, sampleWallClockNs, statSignature } from './stat-signature.ts';

const RECONCILE_DEBOUNCE_MS = 100;
const CONFIRM_DELAY_MS = 200;
const FALLBACK_ACTIVE_MS = 5000;
const FALLBACK_IDLE_MS = 60_000;
const QUIET_ROUNDS_TO_IDLE = 2;

type PathEvent = 'add' | 'change' | 'unlink';

interface SharedSubscription {
  readonly callbacks: Set<SubscribeCallback>;
  readonly ready: Promise<AsyncSubscription | null>;
  refs: number;
}

type ParcelSubscribe = typeof subscribe;

interface ParcelBackend {
  subscribe: ParcelSubscribe;
}

const sharedSubscriptions = new Map<ParcelSubscribe, Map<string, SharedSubscription>>();

async function acquireSharedSubscription(
  parcel: ParcelBackend,
  dir: string,
  callback: SubscribeCallback,
): Promise<{ subscription: AsyncSubscription | null; release: () => void }> {
  let byDir = sharedSubscriptions.get(parcel.subscribe);
  if (byDir === undefined) {
    byDir = new Map<string, SharedSubscription>();
    sharedSubscriptions.set(parcel.subscribe, byDir);
  }
  const key = dir;
  let shared = byDir.get(key);
  if (shared === undefined) {
    const callbacks = new Set<SubscribeCallback>();
    const ready = subscribeParcel(parcel, dir, (err, events) => {
      for (const cb of Array.from(callbacks)) cb(err, events);
    }).then(
      (subscription) => subscription,
      () => null,
    );
    shared = { callbacks, ready, refs: 0 };
    byDir.set(key, shared);
  }
  shared.refs += 1;
  shared.callbacks.add(callback);
  const subscription = await shared.ready;
  let released = false;
  return {
    subscription,
    release: () => {
      if (released) return;
      released = true;
      shared.callbacks.delete(callback);
      shared.refs -= 1;
      if (shared.refs <= 0) {
        byDir.delete(key);
        void shared.ready.then((sub) => sub?.unsubscribe());
      }
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
  const subscriptions = new Map<
    string,
    { unsubscribe: () => Promise<void>; release: () => void }
  >();
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

  const parcelCallback: SubscribeCallback = (err, events) => {
    if (closed) return;
    const notification = classifyParcelNotification(err, events);
    if (notification.kind === 'error') {
      log.warn({ err: notification.error }, '[event-leaf-watcher] parcel subscription error');
      parcelEventsSinceReconcile = true;
      scheduleSoon(RECONCILE_DEBOUNCE_MS);
      return;
    }
    dispatchParcelBatch(notification.events);
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
        const { subscription, release } = await acquireSharedSubscription(
          parcel,
          resolved,
          parcelCallback,
        );
        if (parcel !== parcelModule || closed) {
          release();
          return;
        }
        if (subscription === null) {
          release();
          log.warn(
            { dir },
            '[event-leaf-watcher] @parcel/watcher subscribe failed; retrying on a later sweep',
          );
          return;
        }
        subscriptions.set(dir, { unsubscribe: () => subscription.unsubscribe(), release });
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
        onEvent(known ? 'change' : 'add', path);
      } else {
        pendingSizes.set(path, observation.size);
      }
    }
    for (const path of reference.keys()) {
      if (observed.has(path)) continue;
      reference.delete(path);
      emitted += 1;
      onEvent('unlink', path);
    }
    for (const path of pendingSizes.keys()) {
      if (!observed.has(path)) pendingSizes.delete(path);
    }
    return { failed, emitted };
  };

  const reconcile = async (): Promise<void> => {
    if (closed) return;
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

  function scheduleSoon(delayMs: number): void {
    if (closed || debounceTimer !== null) return;
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      void reconcile();
    }, delayMs);
    debounceTimer.unref?.();
  }

  function scheduleFallback(): void {
    if (closed || fallbackTimer !== null) return;
    const delay = quietRounds >= QUIET_ROUNDS_TO_IDLE ? FALLBACK_IDLE_MS : FALLBACK_ACTIVE_MS;
    fallbackTimer = setTimeout(() => {
      fallbackTimer = null;
      void reconcile();
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
      void reconcile();
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
    for (const held of subscriptions.values()) held.release();
    subscriptions.clear();
  };
}
