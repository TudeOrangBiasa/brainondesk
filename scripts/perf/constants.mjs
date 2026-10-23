export const BASELINE_SCHEMA_VERSION = 1;

export const DEFAULT_SEED = 68;

export const DEFAULT_NOTE_COUNT = 300;

export const DEFAULT_MERMAID_DIAGRAM_COUNT = 20;

export const DEFAULT_RUNS = 1;

export const DEFAULT_IDLE_SECONDS = 60;

export const DEFAULT_STARTUP_TIMEOUT_SECONDS = 30;

export const DEFAULT_RUNTIME = 'both';

export const MERMAID_DOC_NAME = 'perf-mermaid';

export const PERF_OUT_DIRNAME = 'perf-baseline';

export function baselineJsonFilename() {
  return 'perf-baseline.json';
}

export function baselineMarkdownFilename() {
  return 'perf-baseline.md';
}
