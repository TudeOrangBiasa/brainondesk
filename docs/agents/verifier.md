# Verifier

Solo gate for BrainOnDesk. Replaces GitHub Actions.

## Command

```bash
pnpm verify
```

Runs `scripts/verify.sh` from the repo root. Default base is `origin/main`.

## Env knobs

| Var | Default | Effect |
| --- | --- | --- |
| `VERIFY_SKIP_INSTALL` | unset | Set `1` to skip `pnpm install --frozen-lockfile` (pre-push sets this). |
| `VERIFY_SKIP_SMOKE` | unset | Set `1` to skip the CLI vault smoke (`skills/verify-brainondesk/scripts/verify-loop.sh`). |
| `VERIFY_BASE` | `origin/main` | Base ref for policy + gitleaks range. |

## What it covers

1. Frozen install (unless skipped)
2. PR policy (`scripts/check-pr-policy.mjs`) when a PR exists; otherwise `--suggest`
3. gitleaks on commits since base (skipped with a note when the binary is missing)
4. `pnpm run lint` (biome + oxlint + no-comments)
5. `pnpm run typecheck`
6. Unit tests: core, app, desktop, `packages/office-*`, plus policy script tests
7. `build:desktop` (electron-vite bundle, no packaging)
8. CLI vault smoke: init → start → healthz/readyz → status → stop (evidence under `.scratch/verify/`)

Slow suites (server, CLI unit under Bun, native-config) stay out of the gate: `pnpm test:slow`. Drive the real app like a user with `skills/verify-brainondesk/` (see that skill for launch/doctor/drive/evidence/cleanup).

## Who runs it

- **pre-push hook** (`.husky/pre-push`): every push, with `VERIFY_SKIP_INSTALL=1`
- **agent**, again, right before `gh pr create`
- New worktrees must install the hook: `scripts/ensure-worktree-hooks --worktree <path>`

Never push with `--no-verify`. Merges trust this gate; no GitHub status check is required.
