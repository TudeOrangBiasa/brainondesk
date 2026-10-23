import { BASELINE_SCHEMA_VERSION } from './constants.mjs';
import { median } from './proc-stats.mjs';

export function emptyRunShape() {
  return {
    server: {
      rssMB: null,
      pssMB: null,
      heapUsedMB: null,
      heapTotalMB: null,
      idleCpuSec60: null,
      startupMs: null,
      fsStatCallsIdle: null,
      fsReaddirCallsIdle: null,
      timerCallsIdle: null,
    },
    renderer: { jsHeapUsedMB: null, jsHeapTotalMB: null, domNodesMermaidDoc: null, scriptDurationMs: null, mermaidOpenMs: null },
    bundle: { initialJsGzipKB: null, initialJsRawKB: null, initialModuleCount: null },
  };
}

export function shapeRunResult({ runtime, runs, skipped }) {
  return { runtime, runs, skipped: skipped ?? [] };
}

export function medianServerShape(runs) {
  const pick = (key) => median(runs.map((r) => r.server[key]).filter((v) => typeof v === 'number'));
  return {
    rssMB: pick('rssMB'),
    pssMB: pick('pssMB'),
    heapUsedMB: pick('heapUsedMB'),
    heapTotalMB: pick('heapTotalMB'),
    idleCpuSec60: pick('idleCpuSec60'),
    startupMs: pick('startupMs'),
    fsStatCallsIdle: pick('fsStatCallsIdle'),
    fsReaddirCallsIdle: pick('fsReaddirCallsIdle'),
    timerCallsIdle: pick('timerCallsIdle'),
  };
}

export function medianRendererShape(runs) {
  const pick = (key) => median(runs.map((r) => r.renderer[key]).filter((v) => typeof v === 'number'));
  return {
    jsHeapUsedMB: pick('jsHeapUsedMB'),
    jsHeapTotalMB: pick('jsHeapTotalMB'),
    domNodesMermaidDoc: pick('domNodesMermaidDoc'),
    scriptDurationMs: pick('scriptDurationMs'),
    mermaidOpenMs: pick('mermaidOpenMs'),
  };
}

export function buildBaselineReport({ generatedAt, runtime, durations, fixture, runs, bundle, skipped, cli }) {
  return {
    schemaVersion: BASELINE_SCHEMA_VERSION,
    generatedAt,
    runtime,
    fixture,
    cli,
    idleSeconds: durations.idleSeconds,
    runs: runs.map((r) => shapeRunResult(r)),
    medians: {
      server: medianServerShape(runs.flatMap((r) => r.runs.map((run) => run))),
      renderer: medianRendererShape(runs.flatMap((r) => r.runs.map((run) => run))),
      bundle,
    },
    skipped: skipped ?? [],
  };
}

function fmt(value, digits = 1) {
  return typeof value === 'number' ? value.toFixed(digits) : 'n/a';
}

export function renderMarkdownSummary(report) {
  const { server, renderer, bundle } = report.medians;
  const lines = [
    `# perf-baseline (${report.runtime})`,
    '',
    `generated: ${report.generatedAt}`,
    `fixture: ${report.fixture.noteCount} notes + ${report.fixture.diagramCount} mermaid diagrams (seed ${report.fixture.seed}), idle ${report.idleSeconds}s`,
    '',
    '## server (median)',
    '',
    `- rssMB: ${fmt(server.rssMB)}`,
    `- pssMB: ${fmt(server.pssMB)}`,
    `- heapUsedMB: ${fmt(server.heapUsedMB)}`,
    `- heapTotalMB: ${fmt(server.heapTotalMB)}`,
    `- idleCpuSec60: ${fmt(server.idleCpuSec60, 2)}`,
    `- startupMs: ${fmt(server.startupMs, 0)}`,
    `- fsStatCallsIdle: ${fmt(server.fsStatCallsIdle, 0)}`,
    `- fsReaddirCallsIdle: ${fmt(server.fsReaddirCallsIdle, 0)}`,
    `- timerCallsIdle: ${fmt(server.timerCallsIdle, 0)}`,
    '',
    '## renderer (median)',
    '',
    `- jsHeapUsedMB: ${fmt(renderer.jsHeapUsedMB)}`,
    `- jsHeapTotalMB: ${fmt(renderer.jsHeapTotalMB)}`,
    `- domNodesMermaidDoc: ${fmt(renderer.domNodesMermaidDoc, 0)}`,
    `- scriptDurationMs: ${fmt(renderer.scriptDurationMs, 0)}`,
    `- mermaidOpenMs: ${fmt(renderer.mermaidOpenMs, 0)}`,
    '',
    '## bundle',
    '',
    `- initialJsGzipKB: ${fmt(bundle.initialJsGzipKB)}`,
    `- initialJsRawKB: ${fmt(bundle.initialJsRawKB)}`,
    `- initialModuleCount: ${fmt(bundle.initialModuleCount, 0)}`,
    '',
  ];
  if (report.skipped.length > 0) {
    lines.push('## skipped', '');
    for (const skip of report.skipped) lines.push(`- ${skip.scope}: ${skip.reason}`);
    lines.push('');
  }
  return lines.join('\n');
}
