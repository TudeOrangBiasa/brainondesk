import { existsSync } from 'node:fs';
import { resolveXlsxSidecarBinaryPath } from './binary.ts';
import { XlsxSidecarClient, type XlsxSidecarOptions } from './client.ts';

export type { XlsxCellRange, XlsxOpenResult, XlsxSidecarOptions } from './client.ts';
export { XlsxSidecarClient } from './client.ts';

let shared: XlsxSidecarClient | null = null;

export class XlsxSidecarUnavailableError extends Error {
  constructor() {
    super(
      'XLSX sidecar binary is not built. Run: pnpm --filter @inkeep/open-knowledge-office-sheets run build',
    );
    this.name = 'XlsxSidecarUnavailableError';
  }
}

export function isXlsxSidecarAvailable(): boolean {
  const path = resolveXlsxSidecarBinaryPath();
  return path != null && existsSync(path);
}

export function getXlsxSidecarClient(options: XlsxSidecarOptions = {}): XlsxSidecarClient {
  const binaryPath = resolveXlsxSidecarBinaryPath();
  if (!binaryPath || !existsSync(binaryPath)) throw new XlsxSidecarUnavailableError();
  shared ??= new XlsxSidecarClient(binaryPath, options);
  return shared;
}

export function stopXlsxSidecarClient(): void {
  shared?.stop();
  shared = null;
}
