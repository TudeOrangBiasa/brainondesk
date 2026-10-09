# Upstream: @inkeep/open-knowledge-office-parse

Ported from [`packages/file-parse`](https://github.com/TudeOrangBiasa/augmentoffice/tree/main/packages/file-parse)
in [TudeOrangBiasa/augmentoffice](https://github.com/TudeOrangBiasa/augmentoffice) (Apache-2.0).

- Source commit: `39a328637fda6db0f8c5dd3acd8fa26a9cdd1d8c` (2026-08-12, `main`)
- Source paths: `packages/file-parse/src`, `packages/file-parse/tests`
- License: Apache-2.0 — see `LICENSE.upstream`; attribution in `NOTICE.upstream`
- Local adaptations:
  - Renamed `@genoffice/file-parse` to `@inkeep/open-knowledge-office-parse`; docx imports now resolve to `@inkeep/open-knowledge-office-docx`
  - Added `// SPDX-License-Identifier: Apache-2.0` headers to every `.ts` file
  - pnpm workspace manifest, tsdown build, TS 7 + `erasableSyntaxOnly` tsconfigs, vitest config on the shared `okVitestBase`
