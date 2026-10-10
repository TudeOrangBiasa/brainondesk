# Upstream: @inkeep/open-knowledge-office-pptx-render

Ported from [`packages/pptx-render`](https://github.com/TudeOrangBiasa/augmentoffice/tree/main/packages/pptx-render)
in [TudeOrangBiasa/augmentoffice](https://github.com/TudeOrangBiasa/augmentoffice) (Apache-2.0).

- Source commit: `39a328637fda6db0f8c5dd3acd8fa26a9cdd1d8c` (2026-08-12, `main`)
- Source paths: `packages/pptx-render/src`, `packages/pptx-render/tests`
- License: Apache-2.0 — see `LICENSE.upstream`; attribution in `NOTICE.upstream`
- Local adaptations:
  - Renamed `@genoffice/pptx-render` to `@inkeep/open-knowledge-office-pptx-render`; engine imports now resolve to `@inkeep/open-knowledge-office-pptx`
  - Rewrote constructor parameter properties to explicit field declarations (`src/metrics.ts`) for `erasableSyntaxOnly`
  - Dropped the upstream `opentype.js` / `@types/opentype.js` dependencies: nothing in the ported `src` or `tests` imports them (fonts are injected by the host app via the `OpentypeFontLike` interface)
  - Cross-package fixture reads in `tests/build-slide.test.ts` and `tests/connector-geometry.test.ts` repointed at `../office-pptx/tests/fixtures`
  - Added `// SPDX-License-Identifier: Apache-2.0` headers to every `.ts` file
  - pnpm workspace manifest, tsdown build, TS 7 + `erasableSyntaxOnly` tsconfigs, vitest config on the shared `okVitestBase`
