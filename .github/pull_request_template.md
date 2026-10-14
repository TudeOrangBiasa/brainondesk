<!-- Title: Conventional Commits, `type(scope): subject` (feat, fix, docs, refactor, test, chore, perf, ci, build, style, revert). Full rules: CONTRIBUTING.md -->

Closes #

## Summary

<!-- What changed and why, in 1–3 sentences. Add **Scope:** if something was deliberately left out. -->

## Verification evidence

<!-- Every command you actually ran and its result. At minimum `pnpm verify`. UI: a screenshot or manual steps. No tests? Explain why. See docs/TESTING.md. -->

- `pnpm verify`:

## Risk

<!-- Label `risk:low` or `risk:high`; check with `pnpm pr:risk`. Max 3 sentences. High: which rule fired, which files, and the one thing the reviewer must check. Low: what was touched and why no rule applies. -->

## Why this approach

<!-- 2–4 casual sentences: the main decision, the alternative, and why the alternative lost. -->

## Checklist

- [ ] Tests for behavior changes (or a reason why none are needed)
- [ ] `pnpm verify` passes locally
- [ ] No code comments outside the allowlist, no secrets or local paths
- [ ] Docs updated if user-visible behavior changed
- [ ] Code ported from GenOffice carries attribution (`docs/office/LICENSING.md`)

<!-- Agents: open as a draft, never mark ready, never merge. Tude merges every PR. Only Tude adds the `protected-paths-ok` label. -->
