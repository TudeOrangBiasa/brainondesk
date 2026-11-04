# Verification gate (local verifier, no Actions)

BrainOnDesk is **solo**: there are no GitHub Actions workflows. The merge gate is the local verifier. Agents and humans run it before every push (pre-push hook) and again before opening a PR. Merges trust that gate; do not wait on `gh pr checks`.

Upstream OpenKnowledge workflows that needed Inkeep secrets, GitHub Apps, Linear, Vercel, and signing were already removed from this fork. The remaining `verify` and `slow-tests` Actions workflows were deleted too: Actions minutes were noise, and nightly slow-tests stayed red without blocking merges.

## Local: `pnpm verify`

`scripts/verify.sh` is the only gate. Details and env knobs: [docs/agents/verifier.md](../agents/verifier.md). Mode: [docs/agents/repo-mode.md](../agents/repo-mode.md).

| Step | What |
| --- | --- |
| install | `pnpm install --frozen-lockfile` (skip with `VERIFY_SKIP_INSTALL=1`) |
| policy | Conventional Commit title, `Closes #N` / `no-issue`, risk label, protected paths (+ gitleaks when installed) |
| lint | biome + oxlint + no-comments |
| typecheck | turbo typecheck |
| unit tests | core, app, desktop, `packages/office-*`, plus policy script tests |
| build | `build:desktop` (electron-vite; no packaging) |
| smoke | CLI vault lifecycle via `skills/verify-brainondesk/scripts/verify-loop.sh` (skip with `VERIFY_SKIP_SMOKE=1`) |

### Why `build:desktop`, not `build:dir`

`build:desktop` (electron-vite) compiles main, preload, and renderer, and through turbo also builds core, server, app, CLI, and the Rust native-config addon. That catches almost all build errors. `build:dir` adds Electron binary download, native rebuild, and electron-builder packaging: minutes of cost for little PR signal. Packaging is checked when a release ticket asks for it.

### Why unit tests are only core, app, desktop, office

Server tests (>15 min) and CLI/native-config suites make a 15+ minute gate. Run `pnpm test:slow` locally when you change those packages. DOM, integration, e2e, and perf suites stay out of the gate.

### App-driving proof

`skills/verify-brainondesk/` is the project-local verification skill (launch → doctor → drive → evidence → cleanup). The verifier's smoke step covers vault lifecycle. Broader journeys live in `skills/verify-brainondesk/features/`.

## Pre-push hook

`.husky/pre-push` runs `pnpm verify` with `VERIFY_SKIP_INSTALL=1`. New worktrees must install the hook:

```bash
scripts/ensure-worktree-hooks --worktree <path>
scripts/ensure-worktree-hooks --worktree <path> --check
```

Never `git push --no-verify`.

## PR policy (`scripts/check-pr-policy.mjs`)

- Title: `<type>(<scope>)!: <summary>`; types `feat fix docs style refactor perf test build ci chore revert`.
- Body: `Closes #N` / `Fixes #N` / `Resolves #N`, or label `no-issue`.
- Exactly one risk label: `risk:low` or `risk:high`. The label describes blast radius and which automated checks apply, not who may merge. `risk:high` is required for protected paths or breaking (`!`) changes.
- Protected paths need `protected-paths-ok`: `.github/workflows/`, `.github/actions/`, `.github/CODEOWNERS`, `LICENSE*`, `LICENSES/`, `NOTICE*`, `LICENSE.upstream`/`NOTICE.upstream`, `THIRD_PARTY_NOTICES.md`, `scripts/verify.sh`, `scripts/check-pr-policy.mjs`. Agents attach the label after an independent PASS verdict plus `blast-radius` output in the PR body.
- Open every PR ready. Agents merge every tier — including `risk:high` — once the local verifier passed at the current head, an independent verdict is PASS at that head, no `fix` thread is open, the PR is mergeable, and the PR matches its ticket. A red verifier means fix until green, then merge; never weaken a gate. An owner's decision in session is authorization; stale text becomes a ticket.

## What remains from upstream cleanup

- No release, desktop publish, Linear, monorepo-bridge, or CLA workflows.
- Supporting scripts under `.github/scripts/` may still exist when a unit test imports them.
- Known reds outside the gate (including slow server/CLI/native-config) are tracked in `docs/TESTING.md` / known-reds, not in Actions.

## Branch protection note

If GitHub branch protection on `main` still lists a required status check named `verify` from the Actions app, that check can never go green after workflows are deleted. An admin must clear that required check (or the whole status-check requirement). Solo mode does not need it.
