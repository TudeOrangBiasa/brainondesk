// SPDX-License-Identifier: Apache-2.0
import { defineConfig } from 'vitest/config';
import { okVitestBase } from '../../test-support/vitest.base';

export default defineConfig({
  ...okVitestBase,
  test: {
    ...okVitestBase.test,
    include: ['tests/**/*.test.ts'],
    testTimeout: 20_000,
  },
});
