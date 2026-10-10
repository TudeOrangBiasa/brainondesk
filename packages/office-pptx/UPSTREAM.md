# Upstream: @inkeep/open-knowledge-office-pptx

Ported from [`packages/pptx-engine`](https://github.com/TudeOrangBiasa/augmentoffice/tree/main/packages/pptx-engine)
in [TudeOrangBiasa/augmentoffice](https://github.com/TudeOrangBiasa/augmentoffice) (Apache-2.0).

- Source commit: `39a328637fda6db0f8c5dd3acd8fa26a9cdd1d8c` (2026-08-12, `main`)
- Source paths: `packages/pptx-engine/src`, `packages/pptx-engine/tests`
- License: Apache-2.0 — see `LICENSE.upstream`; attribution in `NOTICE.upstream`
- Local adaptations:
  - Renamed `@genoffice/pptx-engine` to `@inkeep/open-knowledge-office-pptx`
  - Rewrote constructor parameter properties to explicit field declarations (`src/zip.ts`) for `erasableSyntaxOnly`
  - `tests/group.test.ts` "rejects group with passthrough elements" now synthesizes its own passthrough element via `appendRawElements` (the ported fixtures contain none, and the shared vitest base requires at least one assertion per test)
  - Added `// SPDX-License-Identifier: Apache-2.0` headers to every `.ts` file
  - pnpm workspace manifest, tsdown build, TS 7 + `erasableSyntaxOnly` tsconfigs, vitest config on the shared `okVitestBase`
- Test fixtures `tests/fixtures/*.pptx` derive slide masters from python-pptx's default template (MIT, Steve Canny); permission notice in `tests/fixtures/LICENSE-python-pptx.txt`
