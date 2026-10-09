// SPDX-License-Identifier: Apache-2.0
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: { index: 'src/index.ts', math: 'src/math.ts' },
  unbundle: false,
  format: 'esm',
  dts: { tsconfig: 'tsconfig.build.json' },
  clean: true,
});
