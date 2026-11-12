# Risk tiers

One label per PR, exactly one. The checker (`pnpm pr:risk`) suggests it from diff size; the body never overrides it.

- `risk:low`: small, reversible, no protected paths, no breaking change. A `PASS` verdict in both lanes (`skills/verify-brainondesk/`) merges it in the same run, no human touch.
- `risk:high`: required when the diff touches protected paths, carries a breaking change (`!`), exceeds the size gate, or when in doubt. A `FAIL` or `INCONCLUSIVE` verdict also forces `risk:high`. Agents never merge these; a human reviews and merges.

`protected-paths-ok` is attached only after Tude approves on that PR, quoted in the PR body. Full gate order lives in `docs/office/CI.md`; this file only decides who may land.
