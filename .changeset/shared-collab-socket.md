---
"@inkeep/open-knowledge": patch
---

All open documents now share one collaboration connection per window instead of one socket each, and idle documents no longer re-sync every 5 seconds — sync happens on edit, reconnect, and tab visibility change.
