#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const binary = process.platform === 'win32' ? 'xlsx-sidecar.exe' : 'xlsx-sidecar';
const source = join(root, 'native', 'xlsx-engine', 'target', 'release', binary);
const destDir = join(root, 'bin');

if (!existsSync(source)) {
  console.error(`xlsx-sidecar release binary not found at ${source}; run cargo build --release first`);
  process.exit(1);
}
mkdirSync(destDir, { recursive: true });
copyFileSync(source, join(destDir, binary));
console.log(`copied ${source} to ${destDir}`);
