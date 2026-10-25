# Upstream: @inkeep/open-knowledge-office-sheets

Ported from [`apps/sheets`](https://github.com/TudeOrangBiasa/augmentoffice/tree/main/apps/sheets)
in [AugmentOffice](https://github.com/TudeOrangBiasa/augmentoffice) (Apache-2.0).

- Source commit: `39a328637fda6db0f8c5dd3acd8fa26a9cdd1d8c` (2026-08-12, `main`)
- Source paths:
  - `apps/sheets/native/xlsx-engine/` → `native/xlsx-engine/` (Rust crate `xlsx-sidecar`, verbatim sources)
  - `apps/sheets/src/main/xlsx-sidecar-client.ts` → ported to `@inkeep/open-knowledge-server` as `src/xlsx-sidecar/client.ts`
- License: Apache-2.0 — see `LICENSE.upstream`; attribution in `NOTICE.upstream`
- Local adaptations:
  - `Cargo.toml`: added `description` and a standalone `[workspace]` stanza so the crate never joins a parent workspace; same crate name, version, edition, deps.
  - `native:build` script resolves cargo from `packages/office-sheets` and copies the built binary into `bin/` for the server resolver and packagers.
  - The TS client was adapted to the BrainOnDesk server conventions: `node:` imports, lazy spawn with an idle reap timer, and server-style error propagation. See the server package for the ported file.
