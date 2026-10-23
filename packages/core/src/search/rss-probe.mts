import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { argv, exit } from 'node:process';

const WORDS = [
  'alpha',
  'arsip',
  'arsitektur',
  'backend',
  'cahaya',
  'catatan',
  'database',
  'desain',
  'dokumen',
  'editor',
  'ekspor',
  'frontend',
  'grafik',
  'harian',
  'impor',
  'indeks',
  'jurnal',
  'kantor',
  'kolaborasi',
  'laporan',
  'migrasi',
  'notulen',
  'observasi',
  'pencarian',
  'proyek',
  'riset',
  'sinkron',
  'template',
  'tugas',
  'unduh',
  'validasi',
  'versi',
];

function usage(): never {
  process.stderr.write('usage: rss-probe.mts <orama|fts5|fts5-disk|docs-only> <notes>\n');
  exit(2);
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

async function main(): Promise<void> {
  const mode = argv[2];
  const noteCount = Number(argv[3]);
  if (!mode || !Number.isInteger(noteCount) || noteCount <= 0) usage();
  const core = await import('./workspace-search.ts');
  const rand = mulberry32(74);
  const pick = () => WORDS[Math.floor(rand() * WORDS.length)];
  const documents = Array.from({ length: noteCount }, (_, i) =>
    core.createWorkspaceSearchDocument({
      kind: 'page',
      path: `notes/note-${String(i).padStart(4, '0')}`,
      title: `${pick()} ${pick()} ${i}`,
      content: Array.from({ length: 120 }, pick).join(' '),
      modifiedTs: i,
    }),
  );
  if (typeof globalThis.gc === 'function') globalThis.gc();
  const docsOnlyRssKb = Math.round(process.memoryUsage.rss() / 1024);
  if (mode === 'docs-only') {
    console.log(JSON.stringify({ mode, noteCount, rssKb: docsOnlyRssKb }));
    return;
  }
  let hold: unknown;
  let dir = '';
  const buildStart = performance.now();
  if (mode === 'orama') {
    hold = core.createWorkspaceSearchCorpus(documents);
  } else {
    const fts = await import('./workspace-search.fts5.ts');
    if (mode === 'fts5-disk') {
      dir = mkdtempSync(join(tmpdir(), 'fts5-rss-'));
      hold = fts.createFts5SearchBackend(documents, { location: join(dir, 'index.sqlite') });
    } else if (mode === 'fts5') {
      hold = fts.createFts5SearchBackend(documents);
    } else {
      usage();
    }
  }
  const buildMs = performance.now() - buildStart;
  void hold;
  if (typeof globalThis.gc === 'function') globalThis.gc();
  const rssKb = Math.round(process.memoryUsage().rss / 1024);
  const heapKb = Math.round(process.memoryUsage().heapUsed / 1024);
  const QUERIES = [
    'arsip',
    'indeks pencarian',
    'laporan proyek',
    'migrasi database',
    'catatan harian',
    'kolaborasi tim',
    'versi dokumen',
    'template tugas',
    'notulen riset',
    'sinkron data',
    'editor desain',
    'ekspor impor',
    'validasi frontend',
    'arsitektur backend',
    'grafik observasi',
    'jurnal kantor',
    'cahaya unduh',
    'tugas proyek',
    'dokumen versi',
    'pencarian indeks',
  ];
  const runQuery = (q: string): void => {
    if (mode === 'orama') {
      core.searchWorkspaceCorpus(hold as never, q, { intent: 'omnibar', limit: 20 });
    } else {
      (hold as { scores(q: string, c: string[], l: number): void }).scores(
        q,
        ['title', 'name', 'path', 'pathSegments'],
        80,
      );
    }
  };
  for (const q of QUERIES) runQuery(q);
  const latencies: number[] = [];
  for (let r = 0; r < 3; r += 1) {
    for (const q of QUERIES) {
      const start = performance.now();
      runQuery(q);
      latencies.push(performance.now() - start);
    }
  }
  latencies.sort((a, b) => a - b);
  console.log(
    JSON.stringify({
      mode,
      noteCount,
      buildMs: Math.round(buildMs * 10) / 10,
      rssKb,
      heapKb,
      docsOnlyRssKb,
      indexRssKb: rssKb - docsOnlyRssKb,
      p50Ms: Math.round(percentile(latencies, 50) * 1000) / 1000,
      p95Ms: Math.round(percentile(latencies, 95) * 1000) / 1000,
    }),
  );
  if (dir) rmSync(dir, { recursive: true, force: true });
}

await main();
