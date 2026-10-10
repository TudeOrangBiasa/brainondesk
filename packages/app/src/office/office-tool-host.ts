export interface OfficeToolCallInput {
  path: string;
  tool: string;
  input: Record<string, unknown>;
}

export interface OfficeToolCallOutput {
  output: unknown;
  isError: boolean;
}

export type OfficeTabToolHandler = (
  tool: string,
  input: Record<string, unknown>,
) => Promise<OfficeToolCallOutput>;

export interface OfficeToolHostRegistration {
  tabId: string;
  path: string;
  handler: OfficeTabToolHandler;
}

export interface OfficeToolHostSnapshot {
  path: string;
  tabId: string;
  allowed: boolean;
}

function normalizeHostPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '');
}

export class OfficeToolHost {
  private readonly handlers = new Map<string, { tabId: string; handler: OfficeTabToolHandler }>();
  private allowed = true;

  setRelayAllowed(allowed: boolean): void {
    this.allowed = allowed;
  }

  isRelayAllowed(): boolean {
    return this.allowed;
  }

  registerTab(registration: OfficeToolHostRegistration): () => void {
    const key = normalizeHostPath(registration.path);
    this.handlers.set(key, { tabId: registration.tabId, handler: registration.handler });
    return () => {
      const current = this.handlers.get(key);
      if (current?.tabId === registration.tabId) this.handlers.delete(key);
    };
  }

  listOpen(): OfficeToolHostSnapshot[] {
    return [...this.handlers.entries()].map(([path, entry]) => ({
      path,
      tabId: entry.tabId,
      allowed: this.allowed,
    }));
  }

  listOpenPaths(): string[] {
    if (!this.allowed) return [];
    return [...this.handlers.keys()];
  }

  async callTool(call: OfficeToolCallInput): Promise<OfficeToolCallOutput> {
    const key = normalizeHostPath(call.path);
    const entry = this.handlers.get(key);
    if (!this.allowed || !entry) {
      return {
        output: `Office file "${call.path}" is not open in any office tab. Open it in the app first, then retry the call.`,
        isError: true,
      };
    }
    return entry.handler(call.tool, call.input);
  }
}

let sharedHost: OfficeToolHost | null = null;

export function getOfficeToolHost(): OfficeToolHost {
  sharedHost ||= new OfficeToolHost();
  return sharedHost;
}

export function setOfficeToolHost(host: OfficeToolHost | null): void {
  sharedHost = host;
}
