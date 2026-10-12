# BrainOnDesk CI

Two workflows, both on GitHub-hosted runners, with a read-only token, no secrets, and actions pinned to SHAs. PR rules live in [CONTRIBUTING.md](../../CONTRIBUTING.md), test layers in [docs/TESTING.md](../TESTING.md).

## `verify` (required)

Runs on every PR (including when the title/body/labels change), on pushes to `main`, and manually. A new push cancels the previous run on the same PR.

| Job | Covers | When |
| --- | --- | --- |
| `policy` | `scripts/check-pr-policy.mjs`: title, `Closes #N`/`no-issue`, risk label + path-based suggestion, protected paths; gitleaks over the PR's commits | PRs only |
| `lint, typecheck, build` | biome + oxlint (+ no-comments), typecheck, `build:desktop` (electron-vite), policy tests | always |
| `test (core/app/desktop/office)` | unit tests per group via turbo, in parallel | always |
| `verify` | aggregator: green only when every job above succeeds (`policy` may be skipped on push) | always |

Branch protection only needs to require **`verify`**. Do not rename this job.

Shared setup lives in `.github/actions/setup` (Node from `.node-version`, pnpm via corepack, pnpm store + `.turbo/cache` caching, Rust toolchain from `rust-toolchain.toml`, frozen install). It is ours, not an upstream leftover.

`build:desktop` is used instead of `build:dir`: it already compiles main/preload/renderer and, through turbo dependencies, core/server/app/CLI/native-config. `build:dir` only adds the Electron download + packaging, several minutes with no extra signal.

## `slow-tests` (not required)

Server (~15 minutes), CLI (~5 minutes), native-config (cargo). Runs nightly at 19:00 UTC (03:00 WITA) on `main`, manually via *Run workflow*, and on PRs that touch `packages/server/`, `packages/cli/`, `packages/native-config/`. GitHub emails nightly failures to Tude.

## Risk label

`policy` suggests a label from the diff and writes its reasoning to the job summary. The rules are mapped from `whips/RISK.md` (skills-for-agents) onto this repo's paths and live in `RISK_RULES` in `scripts/check-pr-policy.mjs`. Hard rules (CI/gate, licensing, breaking, large diffs) reject `risk:low`; soft rules only warn. A `risk:*` label only shows where Tude should focus the review. Tude still does every merge.

## Local

- `pnpm verify`: the same sequence as `verify`. If no PR exists yet, policy only prints the risk suggestion. `VERIFY_SKIP_INSTALL=1` skips the install, `VERIFY_BASE` changes the base (default `origin/main`).
- `pnpm pr:risk`: risk label suggestion for the commits on this branch.
- `pnpm test:slow`: the three slow packages.

## Removed from upstream

- Release/desktop/npm workflows: `release`, `point-release`, `promote-stable`, `select-beta-to-promote`, `desktop-*`, `publish-linux-repo`, `native-config-prebuild`.
- Inkeep integrations: `linear-*`, `monorepo-pr-bridge`, `write-back`, `bug-lane*`, `share-contract-*` + their composite actions, `stale`, `CLA.md`.
- `.github/scripts/` (88 helper files for the workflows above) and the macOS DMG report-path test that imported them.

- Release/changeset tooling: `.changeset/`, `@changesets/cli`, the `changeset`/`version`/`release` scripts, `compute-next-beta`, `compute-stable-version`, `aggregate-stable-changelog`, `build-slack-release-payload`, `render-release-downloads`, `linux-repo/`, `verify-keyring-in-packaged-dmg`, the `check-no-major-changeset` guard.
- `husky` + `lint-staged` (no hooks were committed), `tier1–3`, `check:full:parallel`, `remoteCache.signature` in `turbo.json`.

Deliberately kept: `knip` (the `@lintignore` directive in the no-comments allowlist names knip as its reader, and 4 files in `packages/server/src/link-preview/` use it; the `directive-consumers` test goes red if knip is removed), `check:drift` (i18n, notices, schema snapshot, override floors and TypeScript resolution guards; run manually), `scripts/verify-native-config-in-packaged-dmg.mjs` (can also check `packages/cli/dist` on Linux, used by the runbook `packages/desktop/tests/smoke/native-config-e2e.md`), `known-reds`.
