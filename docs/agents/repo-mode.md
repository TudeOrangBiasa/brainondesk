# Repo mode: solo

BrainOnDesk is a solo repo. The local verifier decides, never hosted checks: merge after `pnpm verify` passes on the PR head (trust pre-push; never wait on `gh pr checks`). The `verify` workflow in `.github/workflows/verify.yml` mirrors the same gates for the record; branch protection requires only its `verify` check name.

Landing follows `RISK.md`: low-risk `PASS` lands in the run, everything else waits for Tude. Conflicts go through `ship-merge-fix` before any verdict. A decision only Tude can answer (product calls, secrets, protected paths, above-risk-authority scope) gets labelled `needs-human` with the exact question, and work continues everywhere else meanwhile.
