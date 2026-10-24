import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { createInterface, type Interface } from 'node:readline';

export const XLSX_SIDECAR_PROTOCOL_VERSION = 1;
const REQUEST_TIMEOUT_MS = 30_000;
const ARCHIVE_TIMEOUT_MS = 180_000;
const MAX_STDERR_LENGTH = 8_192;

export interface XlsxCellRange {
  readonly startRow: number;
  readonly endRow: number;
  readonly startColumn: number;
  readonly endColumn: number;
}

export interface XlsxOpenResult {
  readonly sessionId: string;
  readonly sheets: readonly { readonly id: string; readonly name: string }[];
}

interface PendingRequest {
  readonly resolve: (value: unknown) => void;
  readonly reject: (error: Error) => void;
  readonly timeout: NodeJS.Timeout;
}

interface SidecarResponse {
  readonly version: number;
  readonly requestId: string;
  readonly ok: boolean;
  readonly result?: unknown;
  readonly error?: {
    readonly code: string;
    readonly message: string;
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null) return null;
  return value as Record<string, unknown>;
}

export function parseOpenResult(value: unknown): XlsxOpenResult | null {
  const record = asRecord(value);
  if (!record || typeof record.sessionId !== 'string') return null;
  const sheets = Array.isArray(record.sheets) ? record.sheets : [];
  const parsed = sheets.filter((sheet): sheet is { id: string; name: string } => {
    const entry = asRecord(sheet);
    return !!entry && typeof entry.id === 'string' && typeof entry.name === 'string';
  });
  return { sessionId: record.sessionId, sheets: parsed };
}

export interface XlsxSidecarOptions {
  readonly idleReapMs?: number;
  readonly onSpawn?: (pid: number | undefined) => void;
  readonly onExit?: (pid: number | undefined) => void;
}

export class XlsxSidecarClient {
  private process: ChildProcessWithoutNullStreams | null = null;
  private lines: Interface | null = null;
  private readonly pending = new Map<string, PendingRequest>();
  private stderr = '';
  private reapTimer: NodeJS.Timeout | null = null;
  private readonly binaryPath: string;
  private readonly idleReapMs: number;
  private readonly onSpawn: ((pid: number | undefined) => void) | undefined;
  private readonly onExit: ((pid: number | undefined) => void) | undefined;

  constructor(binaryPath: string, options: XlsxSidecarOptions = {}) {
    this.binaryPath = binaryPath;
    this.idleReapMs = options.idleReapMs ?? 60_000;
    this.onSpawn = options.onSpawn;
    this.onExit = options.onExit;
  }

  readonly isRunning = (): boolean => this.process != null && !this.process.killed;

  getProcessId(): number | null {
    return this.process?.pid ?? null;
  }

  async open(path: string, locale = 'en'): Promise<XlsxOpenResult> {
    const result = await this.request({ command: 'open', path, locale });
    const parsed = parseOpenResult(result);
    if (!parsed) throw new Error('XLSX sidecar returned an invalid open result.');
    return parsed;
  }

  async readRange(input: {
    readonly sessionId: string;
    readonly sheetId: string;
    readonly range: XlsxCellRange;
  }): Promise<unknown> {
    return this.request({ command: 'read_range', ...input });
  }

  async readFormulaCells(input: {
    readonly sessionId: string;
    readonly sheetId: string;
  }): Promise<unknown> {
    return this.request({ command: 'read_formula_cells', ...input });
  }

  async close(sessionId: string): Promise<void> {
    await this.request({ command: 'close', sessionId });
  }

  async readMedia(input: {
    readonly sessionId: string;
    readonly visualId: string;
  }): Promise<unknown> {
    return this.request({ command: 'read_media', ...input }, ARCHIVE_TIMEOUT_MS);
  }

  async archiveManifest(path: string): Promise<unknown> {
    return this.request({ command: 'archive_manifest', path }, ARCHIVE_TIMEOUT_MS);
  }

  start(): void {
    this.ensureStarted();
  }

  stop(): void {
    this.clearReapTimer();
    this.lines?.close();
    this.lines = null;
    this.process?.kill();
    this.process = null;
    this.rejectPending(new Error('XLSX sidecar stopped.'));
  }

  private request(
    command: Readonly<Record<string, unknown>>,
    timeoutMs: number = REQUEST_TIMEOUT_MS,
  ): Promise<unknown> {
    const child = this.ensureStarted();
    const requestId = crypto.randomUUID();
    const payload = JSON.stringify({
      version: XLSX_SIDECAR_PROTOCOL_VERSION,
      requestId,
      ...command,
    });
    const { promise, resolve, reject } = Promise.withResolvers<unknown>();
    const timeout = setTimeout(() => {
      this.pending.delete(requestId);
      reject(new Error('XLSX sidecar request timed out.'));
    }, timeoutMs);
    this.pending.set(requestId, { resolve, reject, timeout });
    child.stdin.write(`${payload}\n`, (error) => {
      if (!error) return;
      const pending = this.pending.get(requestId);
      if (!pending) return;
      clearTimeout(pending.timeout);
      this.pending.delete(requestId);
      pending.reject(error);
    });
    return promise;
  }

  private armReapTimer(): void {
    this.clearReapTimer();
    if (this.idleReapMs <= 0) return;
    this.reapTimer = setTimeout(() => {
      this.reapTimer = null;
      if (this.pending.size === 0) this.stop();
    }, this.idleReapMs);
    this.reapTimer.unref?.();
  }

  private clearReapTimer(): void {
    if (this.reapTimer) clearTimeout(this.reapTimer);
    this.reapTimer = null;
  }

  private ensureStarted(): ChildProcessWithoutNullStreams {
    if (this.process && !this.process.killed) {
      this.armReapTimer();
      return this.process;
    }
    const child = spawn(this.binaryPath, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    this.process = child;
    this.stderr = '';
    this.lines = createInterface({ input: child.stdout });
    this.lines.on('line', (line) => this.handleLine(line));
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      this.stderr = `${this.stderr}${chunk}`.slice(-MAX_STDERR_LENGTH);
    });
    child.once('error', (error) => {
      this.process = null;
      this.clearReapTimer();
      this.rejectPending(error);
    });
    child.once('exit', (code, signal) => {
      const pid = child.pid;
      this.process = null;
      this.clearReapTimer();
      this.lines?.close();
      this.lines = null;
      this.onExit?.(pid);
      const detail = this.stderr.trim();
      const reason = detail
        ? `XLSX sidecar exited: ${detail}`
        : `XLSX sidecar exited with code ${String(code)} and signal ${String(signal)}.`;
      this.rejectPending(new Error(reason));
    });
    this.onSpawn?.(child.pid);
    this.armReapTimer();
    return child;
  }

  private handleLine(line: string): void {
    let response: SidecarResponse;
    try {
      response = JSON.parse(line) as SidecarResponse;
    } catch {
      this.rejectPending(new Error('XLSX sidecar returned invalid JSON.'));
      return;
    }
    if (
      response.version !== XLSX_SIDECAR_PROTOCOL_VERSION ||
      typeof response.requestId !== 'string' ||
      typeof response.ok !== 'boolean'
    ) {
      this.rejectPending(new Error('XLSX sidecar returned an invalid response.'));
      return;
    }
    const pending = this.pending.get(response.requestId);
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.pending.delete(response.requestId);
    this.armReapTimer();
    if (response.ok) {
      pending.resolve(response.result);
      return;
    }
    pending.reject(new Error(response.error?.message ?? 'XLSX sidecar request failed.'));
  }

  private rejectPending(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
  }
}
