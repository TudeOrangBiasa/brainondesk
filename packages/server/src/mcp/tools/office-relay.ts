import type { AgentIdentity } from '../agent-identity.ts';

export interface OfficeToolCallRequest {
  path: string;
  tool: string;
  input: Record<string, unknown>;
  agentId?: string | undefined;
  agentName?: string | undefined;
}

export interface OfficeToolCallResult {
  output: unknown;
  isError: boolean;
}

export interface OfficeTabHandler {
  tabId: string;
  path: string;
  handleToolCall(tool: string, input: Record<string, unknown>): Promise<OfficeToolCallResult>;
}

export type OfficeRelayErrorReason = 'tab-not-open' | 'timeout' | 'cancelled' | 'handler-error';

export class OfficeRelayError extends Error {
  readonly reason: OfficeRelayErrorReason;
  constructor(reason: OfficeRelayErrorReason, message: string) {
    super(message);
    this.name = 'OfficeRelayError';
    this.reason = reason;
  }
}

export const OFFICE_RELAY_DEFAULT_TIMEOUT_MS = 30_000;

export const OFFICE_TAB_NOT_OPEN_MESSAGE =
  'is not open in any office tab. Open it in the app first, then retry the call.';

export function officeTabNotOpenError(path: string): OfficeRelayError {
  return new OfficeRelayError(
    'tab-not-open',
    `Office file "${path}" ${OFFICE_TAB_NOT_OPEN_MESSAGE}`,
  );
}

function normalizeRelayPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '');
}

export interface OfficeRelayTransport {
  callTab(
    path: string,
    tool: string,
    input: Record<string, unknown>,
    opts?: { signal?: AbortSignal | undefined; timeoutMs?: number | undefined },
  ): Promise<OfficeToolCallResult>;
  listOpen(): string[];
}

export class InMemoryOfficeRelayTransport implements OfficeRelayTransport {
  private readonly handlers = new Map<string, OfficeTabHandler>();
  private readonly timeoutMs: number;

  constructor(timeoutMs: number = OFFICE_RELAY_DEFAULT_TIMEOUT_MS) {
    this.timeoutMs = timeoutMs;
  }

  registerHandler(handler: OfficeTabHandler): () => void {
    this.handlers.set(normalizeRelayPath(handler.path), handler);
    return () => {
      if (this.handlers.get(normalizeRelayPath(handler.path)) === handler) {
        this.handlers.delete(normalizeRelayPath(handler.path));
      }
    };
  }

  listOpen(): string[] {
    return [...this.handlers.keys()];
  }

  async callTab(
    path: string,
    tool: string,
    input: Record<string, unknown>,
    opts?: { signal?: AbortSignal | undefined; timeoutMs?: number | undefined },
  ): Promise<OfficeToolCallResult> {
    const key = normalizeRelayPath(path);
    if (opts?.signal?.aborted === true) {
      throw new OfficeRelayError(
        'cancelled',
        `Office tool call "${tool}" for "${path}" was cancelled.`,
      );
    }
    const handler = this.handlers.get(key);
    if (!handler) throw officeTabNotOpenError(path);
    const timeoutMs = opts?.timeoutMs ?? this.timeoutMs;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const outcome = await Promise.race([
        handler.handleToolCall(tool, input),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(
              new OfficeRelayError(
                'timeout',
                `Office tool call "${tool}" for "${path}" timed out after ${timeoutMs}ms. The tab did not answer; retry or reload the tab.`,
              ),
            );
          }, timeoutMs);
          timer.unref?.();
        }),
        ...(opts?.signal
          ? [
              new Promise<never>((_, reject) => {
                opts.signal?.addEventListener(
                  'abort',
                  () => {
                    reject(
                      new OfficeRelayError(
                        'cancelled',
                        `Office tool call "${tool}" for "${path}" was cancelled.`,
                      ),
                    );
                  },
                  { once: true },
                );
              }),
            ]
          : []),
      ]);
      return outcome;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }
}

let sharedTransport: OfficeRelayTransport | null = null;

export function getOfficeRelayTransport(): OfficeRelayTransport {
  sharedTransport ||= new InMemoryOfficeRelayTransport();
  return sharedTransport;
}

export function setOfficeRelayTransport(transport: OfficeRelayTransport | null): void {
  sharedTransport = transport;
}

export function attributionOf(identity: AgentIdentity | undefined): {
  agentId?: string | undefined;
  agentName?: string | undefined;
} {
  if (!identity) return {};
  return {
    ...(identity.connectionId ? { agentId: identity.connectionId } : {}),
    ...(identity.displayName ? { agentName: identity.displayName } : {}),
  };
}
