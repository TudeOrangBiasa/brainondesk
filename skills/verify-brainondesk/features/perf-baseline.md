# perf-baseline

What: before/after numbers for every perf-claim ticket (epic #67).
User path: none directly — harness-only, backing ticket #68.
Harness drive: `pnpm perf:baseline --runtime node|bun|both` on the standard 300-note + 20-diagram fixture; capture `perf-baseline.json`.
End state: JSON carries `server.rssMB`, `server.pssMB`, `server.heapUsedMB`, `server.idleCpuSec60`, `renderer.jsHeapUsedMB`, `renderer.domNodesMermaidDoc`, `bundle.initialJsGzipKB`, `bundle.initialModuleCount`; two consecutive runs agree within 10% on memory.
Gotchas: numbers are machine-specific — compare same-machine before/after only; idle CPU on Bun is the known outlier (#73); ticket #68 must land before any other perf claim cites numbers.
