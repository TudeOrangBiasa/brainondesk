---
name: verify-brainondesk
description: Drive BrainOnDesk like a user (CLI lifecycle, server health, editor smoke) and capture evidence. Use when proving behavior end to end, before/after perf claims, or after any agent loop iteration.
---

# Verify BrainOnDesk

Scripted proof that the app works the way a user touches it. Read cold mid-task: every command below is exact, every path grounded.

Primary surface: **CLI + local server + web editor** (`ok` binary, one-port HTTP+WS+collab). Secondary: **Electron desktop smoke** (Playwright, gated). Mobile (`packages/mobile`) is out of scope until its scaffold lands.

## Launch

Build once, drive each run in its own isolated vault:

```sh
pnpm --filter @inkeep/open-knowledge-cli run build
export VDIR=$(mktemp -d)/vault HOME_TMP=$(mktemp -d)
mkdir -p "$VDIR"
HOME="$HOME_TMP" node packages/cli/dist/cli.mjs init --local-only --no-mcp --cwd "$VDIR"
HOME="$HOME_TMP" node packages/cli/dist/cli.mjs start --cwd "$VDIR" --no-open-browser --idle-shutdown off > /tmp/ok-verify.log 2>&1 &
```

Readiness signal (stdout banner + lock file):

- Banner lines: `Local:   http://127.0.0.1:<port>` and `Press Ctrl+C to stop`.
- Lock: `$VDIR/.ok/local/server.lock` contains `{port,pid,url}` — port is OS-assigned (`port ?? 0`), never assumed.
- `ok` resolves from PATH after install; until then invoke `node packages/cli/dist/cli.mjs` from the repo root.

Teardown (kill what was started, never by process name):

```sh
HOME="$HOME_TMP" node packages/cli/dist/cli.mjs stop --cwd "$VDIR"
rm -rf "$VDIR" "$HOME_TMP"
```

Isolation: two instances side by side need distinct `projectDir` (→ distinct `.ok/local`) plus distinct `HOME` (→ distinct `~/.ok`) plus `port: 0`. A second `ok start` on the same project refuses with `OpenKnowledge is already running on this project (pid N).` — that is the guard working, not a failure. Refusing to double-drive a shared instance beats corrupting the session.

## Doctor

One read-only check, run first whenever anything looks off:

```sh
PORT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$VDIR/.ok/local/server.lock','utf8')).port)")
curl -sf http://127.0.0.1:$PORT/healthz
curl -sf http://127.0.0.1:$PORT/readyz
```

`healthz` → `200 ok`. `readyz` → `200 {"ready":true,...}`; `503` means pending/failed/draining — relaunch past what doctor can see. Also confirm the lock pid is alive and the port answers from this shell before driving.

## Drive

CLI lever (composable, machine-readable, descriptive errors):

```sh
ok status --json        # server state for this project
ok ps --json            # all known servers
ok open <name> --project "$VDIR"
ok lint [path] --json --errors-only
```

Key lifecycle commands: `ok init`, `ok start`, `ok stop [target]`, `ok status`, `ok ps`, `ok clean`, `ok open <name>`, `ok deinit --dry-run --json`, `ok sync --json`. Destructive commands take `--dry-run` (verified below: `deinit`/`uninstall` refuse `~`, no-op without `.ok/`).

Server surface (same port): `GET /healthz`, `GET /readyz`, `POST /api/share/construct-url`, collab WS `ws://127.0.0.1:<port>/collab`. Desktop smoke (gated, unpackaged): `OK_DESKTOP_E2E_SMOKE=1`, launch via `electron.launch` with `--user-data-dir=<tmp>/electron-userdata` and isolated `HOME`; stable handles are `data-testid` first (`nav-create-new`, `create-project-dialog`, `settings-dialog`), then ARIA role+name.

## Evidence

Capture at `.scratch/verify/<run>/`: action plus resulting state, never the final screen alone.

- CLI: command + exit code + `--json` output saved per step; side effects verified on disk (`.ok/config.yml` exists after init, `server.lock` port matches banner, markdown untouched after deinit dry-run).
- Server: `healthz`/`readyz` bodies, `construct-url` round-trip (mint → decode → freshness `current`).
- Desktop (when driven): screenshots at named paths plus visible state assertion; video/trace only on failure.
- Perf claims (epic #67 tickets): `perf-baseline.json` before/after from the same vault fixture; two consecutive runs must agree within 10% on memory numbers. Numbers without a JSON artifact are feelings, not evidence.

Mocks only where a production boundary already isolates (GitHub API via `OK_GH_TOKEN` relay env). Dry-run skips verified by observation: `--dry-run` must leave the filesystem unchanged (diff before/after), never trusted by flag name.

## Cleanup

`ok stop` for the started instance, then `rm -rf` the temp vault and temp HOME. Evidence in `.scratch/verify/<run>/` survives; scratch instances and logs do not. Run cleanup after every failed iteration so nothing strands processes or ports.

## Features

Index: `skills/verify-brainondesk/features/README.md`. One file per user-facing feature: what it is, how a user reaches it, how the harness drives it, what observable end state proves it, gotchas.

## Helpers

- `skills/verify-brainondesk/scripts/verify-loop.sh` — launch → doctor → drive → evidence → cleanup wrapper; see invocation in its header.
- No harness exists yet beyond repo scripts: the CLI itself is the lever (`--json`, `--dry-run`, descriptive errors). If a dedicated driver CLI becomes necessary, it must carry the six CLI properties (composable API, verified dry-run, gradual subcommands incl. `dev-env`, descriptive errors, complete `--help`, machine-readable output).
