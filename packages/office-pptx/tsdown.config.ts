// SPDX-License-Identifier: Apache-2.0
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'table-grid': 'src/table-grid.ts',
    'background-promote': 'src/background-promote.ts',
  },
  unbundle: false,
  format: 'esm',
  dts: { tsconfig: 'tsconfig.build.json' },
  clean: true,
});
