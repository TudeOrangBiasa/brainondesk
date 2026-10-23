# vault-lifecycle

What: turn an empty dir into a project, serve it, stop it cleanly.
User path: `ok init` → `ok start` (browser opens) → edit → `ok stop`.
Harness drive: `verify-loop.sh` (init --local-only --no-mcp, start --no-open-browser --idle-shutdown off, status --json).
End state: `.ok/config.yml` exists; banner shows `Local: http://127.0.0.1:<port>`; `healthz` 200 `ok`, `readyz` 200 ready; `server.lock` port matches banner; after stop, lock released and port closed.
Gotchas: second start on same project refuses with already-running message; port is OS-assigned, never assumed; `HOME` must be isolated per run.
