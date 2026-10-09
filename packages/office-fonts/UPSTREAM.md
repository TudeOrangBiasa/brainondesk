# Upstream: @inkeep/open-knowledge-office-fonts

Ported from [`packages/font-metrics`](https://github.com/TudeOrangBiasa/augmentoffice/tree/main/packages/font-metrics)
in [TudeOrangBiasa/augmentoffice](https://github.com/TudeOrangBiasa/augmentoffice) (Apache-2.0).

- Source commit: `39a328637fda6db0f8c5dd3acd8fa26a9cdd1d8c` (2026-08-12, `main`)
- Source paths: `packages/font-metrics/src`, `packages/font-metrics/tests`
- License: Apache-2.0 — see `LICENSE.upstream`; attribution in `NOTICE.upstream`
- Local adaptations:
  - Renamed `@genoffice/font-metrics` to `@inkeep/open-knowledge-office-fonts`
  - `tests/metrics.test.ts`: macOS-gated tests assert the gate itself first, since the shared vitest base requires at least one assertion per test
  - Added `// SPDX-License-Identifier: Apache-2.0` headers to every `.ts` file
  - pnpm workspace manifest, tsdown build, TS 7 + `erasableSyntaxOnly` tsconfigs, vitest config on the shared `okVitestBase`
