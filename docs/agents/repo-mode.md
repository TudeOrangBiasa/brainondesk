# Repo mode

Solo or team: one word both humans and playbooks read.

- **Mode:** `solo`
- **Solo:** the agent merges after the local verifier passes (pre-push). No waiting on GitHub checks. Trust pre-push; run the verifier again before `gh pr create`. Never `git push --no-verify`.
- **Team:** CI decides like pstack. Required checks green before landing; PRs wait on `gh pr checks`.

This fork is solo. There are no GitHub Actions workflows; merges trust `pnpm verify` via the pre-push hook and the agent re-run before opening a PR.
