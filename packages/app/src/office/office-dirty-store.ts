import { useSyncExternalStore } from 'react';
import { parseEditorTabId } from '@/editor/editor-tabs';

const dirtyOfficePaths = new Set<string>();
const listeners = new Set<() => void>();

function notifyOfficeDirtyListeners(): void {
  for (const listener of listeners) listener();
}

export function setOfficeDirty(officePath: string, dirty: boolean): void {
  const has = dirtyOfficePaths.has(officePath);
  if (dirty === has) return;
  if (dirty) dirtyOfficePaths.add(officePath);
  else dirtyOfficePaths.delete(officePath);
  notifyOfficeDirtyListeners();
}

function subscribeOfficeDirty(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useOfficeDirty(officePath: string): boolean {
  return useSyncExternalStore(
    subscribeOfficeDirty,
    () => dirtyOfficePaths.has(officePath),
    () => false,
  );
}

export function dirtyOfficePathsInTabs(tabIds: readonly string[]): string[] {
  const dirty: string[] = [];
  for (const tabId of tabIds) {
    const tab = parseEditorTabId(tabId);
    if (tab.kind === 'office' && dirtyOfficePaths.has(tab.officePath)) dirty.push(tab.officePath);
  }
  return dirty;
}

export function clearOfficeDirtyForTabs(tabIds: readonly string[]): void {
  let changed = false;
  for (const tabId of tabIds) {
    const tab = parseEditorTabId(tabId);
    if (tab.kind === 'office' && dirtyOfficePaths.delete(tab.officePath)) changed = true;
  }
  if (changed) notifyOfficeDirtyListeners();
}

export function __resetOfficeDirtyForTests(): void {
  dirtyOfficePaths.clear();
  notifyOfficeDirtyListeners();
}
