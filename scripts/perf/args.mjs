import {
  DEFAULT_IDLE_SECONDS,
  DEFAULT_NOTE_COUNT,
  DEFAULT_MERMAID_DIAGRAM_COUNT,
  DEFAULT_RUNS,
  DEFAULT_RUNTIME,
  DEFAULT_SEED,
  DEFAULT_STARTUP_TIMEOUT_SECONDS,
  PERF_OUT_DIRNAME,
} from './constants.mjs';

export const USAGE = [
  'usage: pnpm perf:baseline [options]',
  '',
  'options:',
  '  --runtime <node|bun|both>   server runtime(s) to measure (default: both)',
  '  --runs <n>                  runs per runtime, medians reported (default: 1)',
  '  --idle-seconds <n>          idle window per run (default: 60)',
  '  --notes <n>                 fixture note count (default: 300)',
  '  --diagrams <n>              mermaid diagrams in the mermaid doc (default: 20)',
  '  --seed <n>                  fixture seed (default: 68)',
  '  --multi-vault               start 3 fixture projects per run instead of 1',
  '  --out <dir>                 output directory (default: <repo>/perf-baseline)',
  '  --startup-timeout <s>       seconds to wait for server.lock (default: 30)',
  '  --keep-tmp                  keep temp HOME/vault dirs for inspection',
  '  --skip-renderer             skip the chromium renderer probe',
  '  --skip-bundle               skip the bundle probe',
  '  -h, --help                  show this help',
  '',
].join('\n');

function toIntFlag(name, value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${name} expects a non-negative integer, got ${JSON.stringify(value)}`);
  return parsed;
}

export function parseBaselineArgs(argv) {
  const opts = {
    runtime: DEFAULT_RUNTIME,
    runs: DEFAULT_RUNS,
    idleSeconds: DEFAULT_IDLE_SECONDS,
    noteCount: DEFAULT_NOTE_COUNT,
    diagramCount: DEFAULT_MERMAID_DIAGRAM_COUNT,
    seed: DEFAULT_SEED,
    multiVault: false,
    outDir: null,
    startupTimeoutSeconds: DEFAULT_STARTUP_TIMEOUT_SECONDS,
    keepTmp: false,
    skipRenderer: false,
    skipBundle: false,
    help: false,
  };
  const args = [...argv];
  while (args.length > 0) {
    const arg = args.shift();
    if (arg === '-h' || arg === '--help') {
      opts.help = true;
    } else if (arg === '--runtime') {
      const value = args.shift();
      if (value !== 'node' && value !== 'bun' && value !== 'both') {
        throw new Error(`--runtime expects node|bun|both, got ${JSON.stringify(value)}`);
      }
      opts.runtime = value;
    } else if (arg === '--runs') {
      opts.runs = toIntFlag('--runs', args.shift());
      if (opts.runs < 1) throw new Error('--runs expects at least 1');
    } else if (arg === '--idle-seconds') {
      opts.idleSeconds = toIntFlag('--idle-seconds', args.shift());
      if (opts.idleSeconds < 1) throw new Error('--idle-seconds expects at least 1');
    } else if (arg === '--notes') {
      opts.noteCount = toIntFlag('--notes', args.shift());
    } else if (arg === '--diagrams') {
      opts.diagramCount = toIntFlag('--diagrams', args.shift());
    } else if (arg === '--seed') {
      opts.seed = toIntFlag('--seed', args.shift());
    } else if (arg === '--multi-vault') {
      opts.multiVault = true;
    } else if (arg === '--out') {
      opts.outDir = args.shift() ?? null;
      if (!opts.outDir) throw new Error('--out expects a directory path');
    } else if (arg === '--startup-timeout') {
      opts.startupTimeoutSeconds = toIntFlag('--startup-timeout', args.shift());
      if (opts.startupTimeoutSeconds < 1) throw new Error('--startup-timeout expects at least 1');
    } else if (arg === '--keep-tmp') {
      opts.keepTmp = true;
    } else if (arg === '--skip-renderer') {
      opts.skipRenderer = true;
    } else if (arg === '--skip-bundle') {
      opts.skipBundle = true;
    } else if (arg.startsWith('--runtime=')) {
      const value = arg.slice('--runtime='.length);
      if (value !== 'node' && value !== 'bun' && value !== 'both') {
        throw new Error(`--runtime expects node|bun|both, got ${JSON.stringify(value)}`);
      }
      opts.runtime = value;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return opts;
}

export function runtimesFor(opts) {
  return opts.runtime === 'both' ? ['node', 'bun'] : [opts.runtime];
}

export function defaultOutDir(repoRoot) {
  return `${repoRoot}/${PERF_OUT_DIRNAME}`;
}
