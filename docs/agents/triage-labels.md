# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in skills | Label in our tracker | Meaning                                  |
| --------------- | -------------------- | ---------------------------------------- |
| `needs-triage`  | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`    | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent` | `agent:ready`      | Fully specified, ready for an AFK agent  |
| `ready-for-human` | `ready-for-human`  | Requires human implementation            |
| `wontfix`       | `wontfix`            | Will not be actioned                     |
| `risk-low`      | `risk:low`           | Agent PR safe to merge in a quick batch  |
| `risk-medium`   | —                    | Not used: this repo's policy has only `risk:low` / `risk:high` |
| `risk-high`     | `risk:high`          | Agent PR needs a real human review first |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.
