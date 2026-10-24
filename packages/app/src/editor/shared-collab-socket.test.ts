import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import { Hocuspocus } from '@hocuspocus/server';
import { afterEach, describe, expect, test } from 'vitest';
import { WebSocket, WebSocketServer } from 'ws';
import type * as Y from 'yjs';

const closers: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.allSettled(closers.splice(0).map((close) => close()));
});

interface Harness {
  url: string;
  connectionCount: () => number;
}

async function startHarness(): Promise<Harness> {
  const hocuspocus = new Hocuspocus({ quiet: true });
  const httpServer = createServer();
  let upgrades = 0;
  const wss = new WebSocketServer({ noServer: true });
  httpServer.on('upgrade', (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, (ws) => {
      upgrades += 1;
      const clientConnection = hocuspocus.handleConnection(ws as never, req as unknown as Request);
      ws.on('message', (data: ArrayBuffer | Buffer) => {
        clientConnection.handleMessage(new Uint8Array(data as Buffer));
      });
      ws.on('close', (code: number, reason: Buffer) =>
        clientConnection.handleClose({ code, reason: reason.toString() }),
      );
      ws.on('error', () => ws.terminate());
    });
  });
  const { promise: listening, resolve: resolveListening } = Promise.withResolvers<void>();
  httpServer.listen(0, '127.0.0.1', resolveListening);
  await listening;
  const address = httpServer.address() as AddressInfo;
  closers.push(async () => {
    await hocuspocus.destroy();
    const { promise: wssClosed, resolve: resolveWssClosed } = Promise.withResolvers<void>();
    wss.close(() => resolveWssClosed());
    await wssClosed;
    const { promise: httpClosed, resolve: resolveHttpClosed } = Promise.withResolvers<void>();
    httpServer.close(() => resolveHttpClosed());
    await httpClosed;
  });
  return { url: `ws://127.0.0.1:${address.port}/collab`, connectionCount: () => upgrades };
}

function makeSocket(url: string): HocuspocusProviderWebsocket {
  return new HocuspocusProviderWebsocket({ url, WebSocketPolyfill: WebSocket as never });
}

function awaitSynced(provider: HocuspocusProvider): Promise<void> {
  if (provider.isSynced) return Promise.resolve();
  const { promise, resolve } = Promise.withResolvers<void>();
  provider.on('synced', () => resolve());
  return promise;
}

function awaitSocketStatus(
  socket: HocuspocusProviderWebsocket,
  status: 'connected' | 'disconnected',
): Promise<void> {
  if (socket.status === status) return Promise.resolve();
  const { promise, resolve } = Promise.withResolvers<void>();
  const listener = ({ status: next }: { status: string }) => {
    if (next === status) {
      socket.off('status', listener);
      resolve();
    }
  };
  socket.on('status', listener);
  return promise;
}

function awaitDocText(doc: Y.Doc, expected: string): Promise<void> {
  const ytext = doc.getText('source');
  if (ytext.toString() === expected) return Promise.resolve();
  const { promise, resolve } = Promise.withResolvers<void>();
  const observer = () => {
    if (ytext.toString() === expected) {
      ytext.unobserve(observer);
      resolve();
    }
  };
  ytext.observe(observer);
  return promise;
}

function awaitConverged(left: Y.Doc, right: Y.Doc): Promise<string> {
  const leftText = left.getText('source');
  const rightText = right.getText('source');
  if (leftText.toString() === rightText.toString() && leftText.length > 0) {
    return Promise.resolve(leftText.toString());
  }
  const { promise, resolve } = Promise.withResolvers<string>();
  const check = () => {
    const a = leftText.toString();
    const b = rightText.toString();
    if (a === b && a.length > 0) {
      leftText.unobserve(check);
      rightText.unobserve(check);
      resolve(a);
    }
  };
  leftText.observe(check);
  rightText.observe(check);
  return promise;
}

describe('shared collab socket multiplexing', () => {
  test('N providers on one websocket sync distinct docs over a single TCP upgrade', async () => {
    const harness = await startHarness();
    const socket = makeSocket(harness.url);
    const docNames = ['mux-alpha.md', 'mux-beta.md', 'mux-gamma.md'];
    const providers = docNames.map(
      (name) => new HocuspocusProvider({ websocketProvider: socket, name }),
    );
    closers.push(async () => {
      for (const provider of providers) provider.destroy();
      socket.destroy();
    });
    for (const provider of providers) provider.attach();

    await Promise.all(providers.map((provider) => awaitSynced(provider)));
    expect(harness.connectionCount()).toBe(1);

    providers[0]?.document.getText('source').insert(0, 'alpha-body');
    await awaitDocText(providers[0]?.document as Y.Doc, 'alpha-body');
    expect(providers[1]?.document.getText('source').toString()).toBe('');
    expect(providers[2]?.document.getText('source').toString()).toBe('');
  });

  test('two providers on the same doc converge, and no provider runs a force-sync timer', async () => {
    const harness = await startHarness();
    const socket = makeSocket(harness.url);
    const left = new HocuspocusProvider({ websocketProvider: socket, name: 'mux-shared.md' });
    const right = new HocuspocusProvider({ websocketProvider: socket, name: 'mux-shared.md' });
    closers.push(async () => {
      left.destroy();
      right.destroy();
      socket.destroy();
    });
    left.attach();
    right.attach();
    await Promise.all([awaitSynced(left), awaitSynced(right)]);

    expect(left.configuration.forceSyncInterval).toBe(false);
    expect(right.configuration.forceSyncInterval).toBe(false);
    expect(left.manageSocket).toBe(false);
    expect(right.manageSocket).toBe(false);

    left.document.getText('source').insert(0, 'left-');
    right.document.getText('source').insert(0, 'right-');
    const converged = await awaitConverged(left.document, right.document);
    expect(converged).toHaveLength('left-right-'.length);
    expect(converged).toContain('left-');
    expect(converged).toContain('right-');
    expect(harness.connectionCount()).toBe(1);
  });

  test('edits made while the socket is down replay on reconnect and converge', async () => {
    const harness = await startHarness();
    const socket = makeSocket(harness.url);
    const left = new HocuspocusProvider({ websocketProvider: socket, name: 'mux-offline.md' });
    const right = new HocuspocusProvider({ websocketProvider: socket, name: 'mux-offline.md' });
    closers.push(async () => {
      left.destroy();
      right.destroy();
      socket.destroy();
    });
    left.attach();
    right.attach();
    await Promise.all([awaitSynced(left), awaitSynced(right)]);

    socket.disconnect();
    await awaitSocketStatus(socket, 'disconnected');
    left.document.getText('source').insert(0, 'offline-edit');
    expect(left.document.getText('source').toString()).toBe('offline-edit');

    await socket.connect();
    await awaitSocketStatus(socket, 'connected');
    await awaitDocText(right.document, 'offline-edit');
    expect(left.document.getText('source').toString()).toBe('offline-edit');
  });
});
