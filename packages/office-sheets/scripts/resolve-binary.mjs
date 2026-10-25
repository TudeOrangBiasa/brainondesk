// SPDX-License-Identifier: Apache-2.0
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BINARY_NAME = process.platform === 'win32' ? 'xlsx-sidecar.exe' : 'xlsx-sidecar';

export function binaryName() {
  return BINARY_NAME;
}

export function packageRoot() {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

export function packagedBinaryPath() {
  return join(packageRoot(), 'bin', BINARY_NAME);
}

export function devBinaryPath(profile = 'release') {
  return join(packageRoot(), 'native', 'xlsx-engine', 'target', profile, BINARY_NAME);
}

export function resolveXlsxSidecarBinary() {
  const override = process.env.XLSX_SIDECAR_PATH;
  if (override && override.length > 0) return override;
  const packaged = packagedBinaryPath();
  if (existsSync(packaged)) return packaged;
  const release = devBinaryPath('release');
  if (existsSync(release)) return release;
  const debug = devBinaryPath('debug');
  if (existsSync(debug)) return debug;
  return null;
}
