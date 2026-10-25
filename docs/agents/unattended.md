# Unattended Runs

How agent runs proceed without the user watching in this repo. Read by the `goal` playbook and the `runner` skill.

- **Wake mechanism:** orca/harness loop on this workstation, re-invoking `/whips` (issue queues via `/runner`, single long goals via the `goal` playbook).
- **Run log:** `.scratch/whips/<run>/log.md`, one row per iteration (what changed, check run, predicate movement). The morning report's source.
- **Budget habit:** predicate first, then a stated cap (iterations, hours, PR count). Hitting the cap is a stop, reported as such.
- **Queues vs goals:** issue queues run through `/runner`; single long goals run through the `goal` playbook. Landing follows the risk tier (low lands on PASS with no human touch, high lands after the extra automated checks pass).
- **Verification skill:** `skills/verify-brainondesk/` (launch → doctor → drive → evidence → cleanup); upkeep via `/maintain-verification`, scope limited to that directory.
- **Scheduled maintenance:** `/retro` stale-docs sweep plus verification upkeep, daily, proposals filed, never auto-applied. Wake: harness non-interactive invocation on this workstation. Output sink: issue(s) labelled `type:chore`.
