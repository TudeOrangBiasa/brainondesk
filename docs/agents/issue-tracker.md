# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues in `TudeOrangBiasa/brainondesk`. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v`; `gh` does this automatically when run inside a clone.

## Label vocabulary in use

Five canonical triage roles, plus the repo's own working labels (full map in `docs/agents/triage-labels.md`):

- Triage: `needs-triage` → `needs-info` (waiting on Tude) → `agent:ready` (agent may claim) / `ready-for-human` / `wontfix`.
- Risk on every issue: `risk:low` or `risk:high` — only these two exist, there is no medium.
- Claim: add `in-progress` and assign to self; it is the session's first write.
- Scoping: `epic` for tracker issues, `type:feature` / `type:chore`, `area:*` (core, app, server, desktop, docs, sheets, slides, pdf, acp, build), `phase-*` for the office roadmap, `mobile` / `agent` for the mobile track.
- Agent-ready bodies carry a `Status triage` line (`ready now`, blocker list, or `needs-info` question) at the top — `/triage` writes it, `/whips` reads it.

## Epics and blocking

Epics are tracker issues labelled `epic` holding a Notes / Decisions / checklist body (#26 office roadmap, #67 perf roadmap). Child tickets link back in Indonesian phrasing in the child body — `Bagian dari epic #<n>` (or `nyambung ke epic #<n>` on revised tickets); ordering follows the epic checklist. Blocking via a `Blocked by: #<n>` line is the convention `/wayfinder` writes going forward — no child ticket carries one yet, so treat every open child as unblocked unless its body says otherwise. Frontier: open children of the epic, minus blocked or `in-progress`/assigned; epic checklist order wins.

## Pull requests as a triage surface

**PRs as a request surface: no.**

External PRs are contributions to review, not feature requests to triage. `/triage` skips PRs. A PR that proposes something worth tracking gets a linked issue created by the reviewer; the PR body references it with `Closes #N` per the PR policy.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `epic`, holding the Notes / Decisions-so-far / Fog body. `gh issue create --label epic`.
- **Child ticket**: an issue linked to the map with `Part of #<map>` at the top of the child body, plus the relevant `phase-*` and `area:*` labels. Labels: `wayfinder:<type>` (`research`/`prototype`/`interview`/`task`). Once claimed, add `in-progress` and assign to the driving dev.
- **Blocking**: a `Blocked by: #<n>, #<n>` line at the top of the child body. A ticket is unblocked when every blocker is closed.
- **Frontier query**: list the map's open children, drop any with an open blocker or an assignee; first in map order wins.
- **Claim**: `gh issue edit <n> --add-label in-progress`, the session's first write.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>`, then append a context pointer to the map's Decisions-so-far.
