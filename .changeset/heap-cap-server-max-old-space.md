---
"@inkeep/open-knowledge-desktop": patch
---

The desktop server now caps V8 heap growth at 25% of system RAM (max 4 GB), down from 16 GB, so garbage collection runs sooner on large vaults. Set OK_SERVER_MAX_OLD_SPACE_MB to override the cap.
