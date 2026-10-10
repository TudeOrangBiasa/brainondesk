#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

BASE_REF="${VERIFY_BASE:-origin/main}"
export TURBO_TELEMETRY_DISABLED=1
export DO_NOT_TRACK=1

step() {
  printf '\n==> %s\n' "$1"
}

skip() {
  printf '    skipped: %s\n' "$1"
}

if [ "${VERIFY_SKIP_INSTALL:-0}" != "1" ]; then
  step "install (frozen lockfile)"
  pnpm install --frozen-lockfile
fi

step "PR policy (title, linked issue, protected paths)"
git fetch --quiet origin main || true
BASE_SHA="$(git merge-base "$BASE_REF" HEAD)"
if command -v gh >/dev/null 2>&1 && PR_JSON="$(gh pr view --json title,body,labels 2>/dev/null)"; then
  PR_TITLE="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).title)' "$PR_JSON")" \
  PR_BODY="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).body)' "$PR_JSON")" \
  PR_LABELS="$(node -e 'process.stdout.write(JSON.stringify(JSON.parse(process.argv[1]).labels))' "$PR_JSON")" \
  PR_BASE_SHA="$BASE_SHA" PR_HEAD_SHA=HEAD \
    node scripts/check-pr-policy.mjs
else
  skip "no open PR for this branch yet; protected files touched vs $BASE_REF:"
  git diff --name-only "$BASE_SHA"...HEAD | node -e '
    import("./scripts/check-pr-policy.mjs").then(({ protectedFiles }) => {
      const files = require("node:fs").readFileSync(0, "utf8").split("\n").filter(Boolean);
      const hits = protectedFiles(files);
      console.log(hits.length ? hits.map((f) => "      " + f).join("\n") + "\n    (needs the protected-paths-ok label from a human)" : "      none");
    });
  '
fi

step "secret scan (gitleaks, commits since $BASE_REF)"
if command -v gitleaks >/dev/null 2>&1; then
  gitleaks git --no-banner --redact --log-opts="${BASE_SHA}..HEAD" .
else
  skip "gitleaks not installed (CI runs it; Fedora: sudo dnf install gitleaks)"
fi

step "lint"
pnpm run lint

step "typecheck"
pnpm run typecheck

step "unit tests (core, app, desktop)"
pnpm exec turbo run test \
  --filter=@inkeep/open-knowledge-core \
  --filter=@inkeep/open-knowledge-app \
  --filter=@inkeep/open-knowledge-desktop \
  --output-logs=errors-only
pnpm exec vitest run --config vitest.scripts.config.ts scripts/check-pr-policy.test.mjs

step "build desktop bundle"
pnpm exec turbo run build:desktop --filter=@inkeep/open-knowledge-desktop --output-logs=errors-only

printf '\nverify: all gates passed\n'
