---
"@inkeep/open-knowledge": patch
---

Idle file-watching churn is down: leaf config and managed-artifact watchers are event-driven instead of polled, the ignore multi-path watcher stays polled to avoid duplicating native subscriptions, and the derived-index file-existence sweep backs off to once a minute when idle.
