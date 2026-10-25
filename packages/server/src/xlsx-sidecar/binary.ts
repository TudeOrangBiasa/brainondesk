import { resolveXlsxSidecarBinary } from '@inkeep/open-knowledge-office-sheets/binary';

const XLSX_SIDECAR_ENV_VAR = 'XLSX_SIDECAR_PATH';

export function resolveXlsxSidecarBinaryPath(): string | null {
  if (process.env[XLSX_SIDECAR_ENV_VAR]) return process.env[XLSX_SIDECAR_ENV_VAR] as string;
  return resolveXlsxSidecarBinary();
}
