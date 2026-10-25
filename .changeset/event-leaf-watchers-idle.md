---
"@inkeep/open-knowledge": patch
---

Idle file-watching churn is down: project leaf config watchers are event-driven and share the file watcher's native subscription instead of polling, user-scope leaves (user config, skill state, managed skills) stay polled since they sit outside the content tree, the ignore multi-path watcher stays polled to avoid duplicating native subscriptions, and the derived-index file-existence sweep backs off to once a minute when idle.
