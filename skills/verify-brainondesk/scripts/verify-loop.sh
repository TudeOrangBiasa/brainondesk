#!/usr/bin/env bash
set -euo pipefail
RUN_DIR=".scratch/verify/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RUN_DIR"
VDIR=$(mktemp -d)/vault
HOME_TMP=$(mktemp -d)
mkdir -p "$VDIR"
cleanup() {
  HOME="$HOME_TMP" node packages/cli/dist/cli.mjs stop --cwd "$VDIR" >/dev/null 2>&1 || true
  rm -rf "$VDIR" "$HOME_TMP"
}
trap cleanup EXIT
set +e
{
  echo "## doctor"
  HOME="$HOME_TMP" node packages/cli/dist/cli.mjs init --local-only --no-mcp --cwd "$VDIR"
  echo "init-exit=$?"
  HOME="$HOME_TMP" node packages/cli/dist/cli.mjs start --cwd "$VDIR" --no-open-browser --idle-shutdown off > "$RUN_DIR/server.log" 2>&1 &
  SRV_PID=$!
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
  else
    cat "$RUN_DIR/healthz.txt"
    echo
    for i in $(seq 1 60); do
      CODE=$(curl -s -o "$RUN_DIR/readyz.txt" -w "%{http_code}" "http://127.0.0.1:$PORT/readyz")
      grep -q '"ready":true' "$RUN_DIR/readyz.txt" 2>/dev/null && break
      sleep 1
    done
    echo "readyz-http=$CODE"
    echo
    echo "## drive"
    HOME="$HOME_TMP" node packages/cli/dist/cli.mjs status --json --cwd "$VDIR" | tee "$RUN_DIR/status.json"
  fi
  echo "drive-exit=$?"
} 2>&1 | tee "$RUN_DIR/log.md"
set -e
echo "evidence: $RUN_DIR"
