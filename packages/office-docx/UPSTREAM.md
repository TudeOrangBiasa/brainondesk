# Upstream: @inkeep/open-knowledge-office-docx

Ported from [`packages/docx-engine`](https://github.com/TudeOrangBiasa/augmentoffice/tree/main/packages/docx-engine)
in [TudeOrangBiasa/augmentoffice](https://github.com/TudeOrangBiasa/augmentoffice) (Apache-2.0).

- Source commit: `39a328637fda6db0f8c5dd3acd8fa26a9cdd1d8c` (2026-08-12, `main`)
- Source paths: `packages/docx-engine/src`, `packages/docx-engine/tests`, `packages/docx-engine/scripts/generate-fixtures.ts`
- License: Apache-2.0 — see `LICENSE.upstream`; attribution in `NOTICE.upstream`
- Local adaptations:
  - Renamed `@genoffice/docx-engine` to `@inkeep/open-knowledge-office-docx`
  - No TypeScript source changes needed beyond headers (strict + `verbatimModuleSyntax` + `erasableSyntaxOnly` clean as ported)
  - `scripts/make-revision-demo.ts` not ported (throwaway manual-verification script writing to `/tmp`)
  - Added `// SPDX-License-Identifier: Apache-2.0` headers to every `.ts` file
  - pnpm workspace manifest, tsdown build, TS 7 + `erasableSyntaxOnly` tsconfigs, vitest config on the shared `okVitestBase`
