import type { AsyncSubscription, SubscribeCallback, subscribe } from '@parcel/watcher';
import { subscribeParcel } from './parcel-subscription.ts';

type ParcelSubscribe = typeof subscribe;

interface ParcelBackend {
  subscribe: ParcelSubscribe;
}

export interface ParcelHubWatcher {
  readonly onBatch: SubscribeCallback;
  readonly onSubscriptionError: SubscribeCallback;
}

export interface ParcelHub {
  readonly nativeDir: string;
  readonly nativeSubscription: Promise<AsyncSubscription | null>;
  readonly addWatcher: (watcher: ParcelHubWatcher) => () => void;
}

interface NativeFanout {
  readonly batches: Set<SubscribeCallback>;
  readonly errors: Set<SubscribeCallback>;
  readonly nativeSubscription: Promise<AsyncSubscription | null>;
  refs: number;
}

const nativeFanouts = new Map<ParcelSubscribe, Map<string, NativeFanout>>();

const isWithinDir = (candidate: string, ancestor: string): boolean =>
  candidate === ancestor || candidate.startsWith(`${ancestor}/`);

export function acquireParcelHub(
  parcel: ParcelBackend,
  dir: string,
  options?: Parameters<typeof subscribeParcel>[3],
  platform?: NodeJS.Platform,
): ParcelHub & { readonly release: () => Promise<void> } {
  let byDir = nativeFanouts.get(parcel.subscribe);
  if (byDir === undefined) {
    byDir = new Map<string, NativeFanout>();
    nativeFanouts.set(parcel.subscribe, byDir);
  }
  let fanout = byDir.get(dir);
  if (fanout === undefined) {
    const batches = new Set<SubscribeCallback>();
    const errors = new Set<SubscribeCallback>();
    const nativeSubscription = subscribeParcel(
      parcel,
      dir,
      (err, events) => {
        if (err) {
          return Promise.all(Array.from(errors).map((onError) => onError(err, events)));
        }
        return Promise.all(Array.from(batches).map((onBatch) => onBatch(null, events)));
      },
      options,
      platform,
    ).then(
      (subscription) => subscription,
      () => null,
    );
    fanout = { batches, errors, nativeSubscription, refs: 0 };
    byDir.set(dir, fanout);
  }
  fanout.refs += 1;
  const entry = fanout;
  let released = false;
  return {
    nativeDir: dir,
    nativeSubscription: entry.nativeSubscription,
    addWatcher: (watcher) => {
      entry.batches.add(watcher.onBatch);
      entry.errors.add(watcher.onSubscriptionError);
      let removed = false;
      return () => {
        if (removed) return;
        removed = true;
        entry.batches.delete(watcher.onBatch);
        entry.errors.delete(watcher.onSubscriptionError);
      };
    },
    release: async () => {
      if (released) return;
      released = true;
      entry.refs -= 1;
      if (entry.refs > 0) return;
      if (byDir.get(dir) === entry) byDir.delete(dir);
      await entry.nativeSubscription.then((sub) => sub?.unsubscribe());
    },
  };
}

export function findCoveringParcelHub(
  parcel: ParcelBackend,
  dir: string,
): (ParcelHub & { readonly release: () => Promise<void> }) | undefined {
  const byDir = nativeFanouts.get(parcel.subscribe);
  if (byDir === undefined) return undefined;
  let bestDir: string | undefined;
  let best: NativeFanout | undefined;
  for (const [nativeDir, fanout] of byDir) {
    if (!isWithinDir(dir, nativeDir)) continue;
    if (bestDir !== undefined && nativeDir.length <= bestDir.length) continue;
    bestDir = nativeDir;
    best = fanout;
  }
  if (bestDir === undefined || best === undefined) return undefined;
  const entry = best;
  const nativeDir = bestDir;
  entry.refs += 1;
  let released = false;
  return {
    nativeDir,
    nativeSubscription: entry.nativeSubscription,
    addWatcher: (watcher) => {
      entry.batches.add(watcher.onBatch);
      entry.errors.add(watcher.onSubscriptionError);
      let removed = false;
      return () => {
        if (removed) return;
        removed = true;
        entry.batches.delete(watcher.onBatch);
        entry.errors.delete(watcher.onSubscriptionError);
      };
    },
    release: async () => {
      if (released) return;
      released = true;
      entry.refs -= 1;
      if (entry.refs > 0) return;
      if (byDir.get(nativeDir) === entry) byDir.delete(nativeDir);
      await entry.nativeSubscription.then((sub) => sub?.unsubscribe());
    },
  };
}

export const __resetParcelHubForTests = (): void => {
  nativeFanouts.clear();
};
