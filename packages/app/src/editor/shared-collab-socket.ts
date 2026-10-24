import { HocuspocusProviderWebsocket } from '@hocuspocus/provider';

const sharedSockets = new Map<string, HocuspocusProviderWebsocket>();

export function getSharedCollabSocket(collabUrl: string): HocuspocusProviderWebsocket {
  const existing = sharedSockets.get(collabUrl);
  if (existing) return existing;
  const created = new HocuspocusProviderWebsocket({ url: collabUrl });
  sharedSockets.set(collabUrl, created);
  return created;
}

export function __sharedCollabSocketCount(): number {
  return sharedSockets.size;
}

export function __resetSharedCollabSockets(): void {
  for (const socket of sharedSockets.values()) {
    try {
      socket.destroy();
    } catch {}
  }
  sharedSockets.clear();
}
