import { describe, expect, test } from 'vitest';
import {
  createWorkspaceSearchCorpus,
  createWorkspaceSearchDocument,
  searchWorkspaceCorpus,
} from './workspace-search.ts';

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

function makeVault(noteCount: number, seed: number) {
  const rand = mulberry32(seed);
  const pick = () => WORDS[Math.floor(rand() * WORDS.length)];
  return Array.from({ length: noteCount }, (_, i) => {
    const title = `${pick()} ${pick()} ${i}`;
    const content = Array.from({ length: 120 }, pick).join(' ');
    return createWorkspaceSearchDocument({
      kind: 'page',
      path: `notes/note-${String(i).padStart(4, '0')}`,
      title,
      content,
      modifiedTs: i,
    });
  });
}

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

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

describe('orama baseline benchmark', () => {
  test.each([300, 5000])(
    'vault %i notes: build + omnibar latency',
    (noteCount) => {
      const documents = makeVault(noteCount, 74);
      const buildStart = performance.now();
      const corpus = createWorkspaceSearchCorpus(documents);
      const buildMs = performance.now() - buildStart;
      const latencies: number[] = [];
      const top5: string[][] = [];
      for (const query of QUERIES) {
        const start = performance.now();
        const results = searchWorkspaceCorpus(corpus, query, { intent: 'omnibar', limit: 20 });
        latencies.push(performance.now() - start);
        top5.push(results.slice(0, 5).map((r) => r.document.id));
      }
      latencies.sort((a, b) => a - b);
      process.stdout.write(
        `[orama-base] notes=${noteCount} buildMs=${buildMs.toFixed(1)} ` +
          `p50=${percentile(latencies, 50).toFixed(3)}ms p95=${percentile(latencies, 95).toFixed(3)}ms ` +
          `nonEmpty=${top5.filter((t) => t.length > 0).length}/${QUERIES.length}\n`,
      );
      for (const [i, ids] of top5.entries()) {
        process.stdout.write(`[orama-top5] notes=${noteCount} q=${i} ${ids.join(',')}\n`);
      }
      expect(top5.filter((t) => t.length > 0).length).toBeGreaterThan(0);
    },
    120000,
  );
});
