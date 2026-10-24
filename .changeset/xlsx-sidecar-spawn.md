---
'@inkeep/open-knowledge': patch
---

Server can now stream .xlsx workbook data through a lazily spawned Rust sidecar, keeping large sheets out of the JS heap.
