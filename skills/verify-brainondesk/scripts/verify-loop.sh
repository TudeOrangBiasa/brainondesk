#!/usr/bin/env bash
set -euo pipefail
RUN_DIR=".scratch/verify/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RUN_DIR"
ROOT=$(mktemp -d)
VDIR="$ROOT/vault"
HOME_TMP=$(mktemp -d)
mkdir -p "$VDIR"
cleanup() {
  local lock pid
  if [ -f "$VDIR/.ok/local/server.lock" ]; then
    pid=$(node -e "try{console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).pid||'')}catch{console.log('')}" "$VDIR/.ok/local/server.lock" 2>/dev/null || true)
  fi
  HOME="$HOME_TMP" node packages/cli/dist/cli.mjs stop --cwd "$VDIR" >/dev/null 2>&1 || true
  if [ -n "${pid:-}" ] && kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    for _ in $(seq 1 20); do
      kill -0 "$pid" 2>/dev/null || break
      sleep 0.25
    done
    kill -9 "$pid" 2>/dev/null || true
  fi
  rm -rf "$ROOT" "$HOME_TMP" || true
}
trap cleanup EXIT
set +e
{
  echo "## doctor"
  HOME="$HOME_TMP" node packages/cli/dist/cli.mjs init --local-only --no-mcp --cwd "$VDIR"
  echo "init-exit=$?"
  HOME="$HOME_TMP" node packages/cli/dist/cli.mjs start --cwd "$VDIR" --no-open-browser --idle-shutdown off > "$RUN_DIR/server.log" 2>&1 &
  PORT=""
  for i in $(seq 1 60); do
    if [ -f "$VDIR/.ok/local/server.lock" ]; then
      PORT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$VDIR/.ok/local/server.lock','utf8')).port)" 2>/dev/null) || PORT=""
    fi
    if [ -n "$PORT" ] && curl -sf "http://127.0.0.1:$PORT/healthz" > "$RUN_DIR/healthz.txt" 2>/dev/null; then
      break
    fi
    sleep 1
  done
  echo "port=$PORT"
  if [ -z "$PORT" ]; then
    echo "FAIL: server never became ready; tail of server.log:"
    tail -20 "$RUN_DIR/server.log"
    exit 1
  else
    cat "$RUN_DIR/healthz.txt"
    echo
    CODE=""
    for i in $(seq 1 60); do
      CODE=$(curl -s -o "$RUN_DIR/readyz.txt" -w "%{http_code}" "http://127.0.0.1:$PORT/readyz")
      grep -q '"ready":true' "$RUN_DIR/readyz.txt" 2>/dev/null && break
      sleep 1
    done
    echo "readyz-http=$CODE"
    if ! grep -q '"ready":true' "$RUN_DIR/readyz.txt" 2>/dev/null; then
      echo "FAIL: readyz never ready"
      exit 1
    fi
    echo
    echo "## drive"
    HOME="$HOME_TMP" node packages/cli/dist/cli.mjs status --json --cwd "$VDIR" | tee "$RUN_DIR/status.json"
  fi
  echo "drive-exit=$?"
} 2>&1 | tee "$RUN_DIR/log.md"
SMOKE_RC=${PIPESTATUS[0]}
set -e
echo "evidence: $RUN_DIR"
exit "$SMOKE_RC"
