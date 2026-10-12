# Testing in BrainOnDesk

The short rule: test behavior, not implementation. Every PR that changes behavior ships a test that would fail if that behavior broke, plus verification evidence in the PR body.

## Test layers

| Layer | Covers | Runs in | Local command |
| --- | --- | --- | --- |
| Policy | PR title, `Closes #N`, risk label, protected paths, gitleaks | `verify` (every PR) | `pnpm verify`, `pnpm pr:risk` |
| Static | biome, oxlint (+ no-comments rule), typecheck | `verify` | `pnpm run lint`, `pnpm run typecheck` |
| Unit: core | domain logic, markdown, schema | `verify` | `pnpm exec turbo run test --filter=@inkeep/open-knowledge-core` |
| Unit: app | editor and UI (Vitest, node) | `verify` | `pnpm exec turbo run test --filter=@inkeep/open-knowledge-app` |
| Unit: desktop | Electron main/preload, config builder | `verify` | `pnpm exec turbo run test --filter=@inkeep/open-knowledge-desktop` |
| Unit: office | `packages/office-*` (docx, pptx, parse, fonts, render) | `verify` | `pnpm exec turbo run test --filter='./packages/office-*'` |
| Build | electron-vite desktop bundle (no packaging) | `verify` | `pnpm exec turbo run build:desktop --filter=@inkeep/open-knowledge-desktop` |
| Slow: server | local collaboration server, ~15 minutes | `slow-tests` | `pnpm exec turbo run test --filter=@inkeep/open-knowledge-server` |
| Slow: CLI | CLI commands, ~5 minutes | `slow-tests` | `pnpm exec turbo run test --filter=@inkeep/open-knowledge` |
| Slow: native-config | `toml_edit` Rust crate (cargo test) | `slow-tests` | `pnpm exec turbo run test --filter=@inkeep/open-knowledge-native-config` |
| Local only | `test:dom`, `test:integration`, `test:e2e`/`test:visual`/`test:a11y` (Playwright), `test:perf`, `test:health`, `test:uncached`, `test:network` | not in CI | see `scripts` in the relevant package's `package.json` |

`pnpm verify` = every `verify` row above. `pnpm test:slow` = the three slow rows.

## When each layer runs

- **`verify`** (required, ~3 minutes): on every push to a PR and to `main`. This is the only check that must be green before merge.
- **`slow-tests`** (not required): nightly at 03:00 WITA on `main`, manually via Actions › slow-tests › *Run workflow*, and automatically on PRs that touch `packages/server/`, `packages/cli/`, or `packages/native-config/`. If it is red on a PR, say so in the PR body: either a regression from this PR, or already red on `main`.
- **Local only**: run these when the PR touches that area (for example Playwright for editor interaction changes) and paste the results into the verification evidence. They are not in CI yet because they need a real browser/Electron or take a long time.

## Rules for writing tests

1. **Test behavior, not implementation.** Test through the module's public API: input → output, or action → visible effect (file saved, event emitted, UI changed). Do not assert the order of internal calls, private function names, or mock contents that merely copy the code.
2. **Bug fixes start with a red test.** Write a test that reproduces the bug, confirm it fails on `main`, then fix it.
3. **Mock only at system boundaries**: network, time, the filesystem outside a temp dir, child processes. Never mock our own code.
4. **Deterministic.** No `sleep` for waiting, no network (see `test-support/no-net-connect.ts`), use your own temp dir.
5. **Tests that read files outside their own package** are named `*.uncached.test.*` (a Turbo cache rule, see `AGENTS.md`).
6. **Tests expected to fail** are pinned with `expectKnownBug`, never silently `skip`ped. The rules are in `test-support/KNOWN-REDS.md`.
7. **Never weaken a gate to get green.** If a gate is wrong, fix the gate in a separate PR with a rationale.

## What every PR must include

- Behavior change → a new or updated test, at the lowest layer that can catch the bug.
- A **Verification evidence** section: the commands you actually ran and their results (at minimum `pnpm verify`), plus manual test steps or screenshots for UI.
- If a test makes no sense (docs, copy, config), explain why in the verification evidence.

## Failures already on `main`

Not regressions and not part of the gate: `scripts/check-override-floors.test.mjs`, `scripts/check-typescript-resolution.test.mjs`, `test-support/setup-files-contract.test.ts`, `packages/desktop/tests/smoke/_helpers/dock-state-ready.test.ts`. The PowerShell tests in `packages/core/src/handoff/terminal-launch.test.ts` require `pwsh` when `CI=true` (GitHub runners have it). The two CLI tests `the npx fallback runs with this chain's channel` only fail on machines where `npx` lives in a different location; they pass in CI. If you fix one of these, remove it from this list.
