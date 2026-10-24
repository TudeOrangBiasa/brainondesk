import { describe, expect, test } from 'vitest';
import {
  buildBaselineReport,
  emptyRunShape,
  medianRendererShape,
  medianServerShape,
  renderMarkdownSummary,
} from './report.mjs';
import { BASELINE_SCHEMA_VERSION } from './constants.mjs';

function serverRun(partial) {
  return { server: { ...emptyRunShape().server, ...partial }, renderer: emptyRunShape().renderer };
}

describe('emptyRunShape', () => {
  test('covers the eight required contract fields as nulls', () => {
    const shape = emptyRunShape();
    expect(shape.server.rssMB).toBeNull();
    expect(shape.server.pssMB).toBeNull();
    expect(shape.server.heapUsedMB).toBeNull();
    expect(shape.server.idleCpuSec60).toBeNull();
    expect(shape.renderer.jsHeapUsedMB).toBeNull();
    expect(shape.renderer.domNodesMermaidDoc).toBeNull();
    expect(shape.bundle.initialJsGzipKB).toBeNull();
    expect(shape.bundle.initialModuleCount).toBeNull();
  });
});

describe('medianServerShape', () => {
  test('medians numeric runs and ignores nulls', () => {
    const shape = medianServerShape([
      serverRun({ rssMB: 300, heapUsedMB: null }),
      serverRun({ rssMB: 100, heapUsedMB: 50 }),
      serverRun({ rssMB: 200, heapUsedMB: 150 }),
    ]);
    expect(shape.rssMB).toBe(200);
    expect(shape.heapUsedMB).toBe(100);
    expect(shape.pssMB).toBeNull();
  });
});

describe('medianRendererShape', () => {
  test('medians renderer runs', () => {
    const shape = medianRendererShape([
      { renderer: { jsHeapUsedMB: 40, jsHeapTotalMB: 60, domNodesMermaidDoc: 1000, scriptDurationMs: 5, mermaidOpenMs: 900 } },
      { renderer: { jsHeapUsedMB: 60, jsHeapTotalMB: 80, domNodesMermaidDoc: 1200, scriptDurationMs: 7, mermaidOpenMs: 1100 } },
    ]);
    expect(shape.jsHeapUsedMB).toBe(50);
    expect(shape.domNodesMermaidDoc).toBe(1100);
  });
});

describe('buildBaselineReport', () => {
  test('shapes the full report with schema version and medians', () => {
    const report = buildBaselineReport({
      generatedAt: '2026-10-23T00:00:00.000Z',
      runtime: 'node',
      durations: { idleSeconds: 60 },
      fixture: { seed: 68, noteCount: 300, diagramCount: 20, mermaidDocName: 'perf-mermaid', vaults: 1 },
      runs: [
        {
          runtime: 'node',
          runs: [serverRun({ rssMB: 300, pssMB: 250, heapUsedMB: 120, idleCpuSec60: 1.5 })],
          skipped: [],
        },
      ],
      bundle: { initialJsGzipKB: 2200, initialJsRawKB: 6600, initialModuleCount: 282 },
      skipped: [{ scope: 'renderer', reason: 'x' }],
      cli: { node: 'v24.0.0' },
    });
    expect(report.schemaVersion).toBe(BASELINE_SCHEMA_VERSION);
    expect(report.runtime).toBe('node');
    expect(report.medians.server.rssMB).toBe(300);
    expect(report.medians.bundle.initialModuleCount).toBe(282);
    expect(report.skipped).toHaveLength(1);
  });
});

describe('renderMarkdownSummary', () => {
  test('renders the eight contract fields plus skips', () => {
    const report = buildBaselineReport({
      generatedAt: '2026-10-23T00:00:00.000Z',
      runtime: 'both',
      durations: { idleSeconds: 60 },
      fixture: { seed: 68, noteCount: 300, diagramCount: 20, mermaidDocName: 'perf-mermaid', vaults: 1 },
      runs: [
        {
          runtime: 'node',
          runs: [
            {
              ...serverRun({ rssMB: 300, pssMB: 250, heapUsedMB: 120, idleCpuSec60: 1.5 }),
              renderer: { jsHeapUsedMB: 40, jsHeapTotalMB: 60, domNodesMermaidDoc: 1100, scriptDurationMs: 6, mermaidOpenMs: 1000 },
            },
          ],
          skipped: [],
        },
      ],
      bundle: { initialJsGzipKB: 2200, initialJsRawKB: 6600, initialModuleCount: 282 },
      skipped: [],
      cli: { node: 'v24.0.0', bun: '1.4.2' },
    });
    const md = renderMarkdownSummary(report);
    for (const field of ['rssMB', 'pssMB', 'heapUsedMB', 'idleCpuSec60', 'jsHeapUsedMB', 'domNodesMermaidDoc', 'initialJsGzipKB', 'initialModuleCount']) {
      expect(md).toContain(field);
    }
    expect(md).toContain('300 notes');
    expect(md).toContain('runtimes: node v24.0.0, bun 1.4.2');
  });
});
