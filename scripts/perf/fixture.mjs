import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_MERMAID_DIAGRAM_COUNT,
  DEFAULT_NOTE_COUNT,
  DEFAULT_SEED,
  MERMAID_DOC_NAME,
} from './constants.mjs';

export function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WORDS = [
  'alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india', 'juliet',
  'kilo', 'lima', 'mike', 'november', 'oscar', 'papa', 'quebec', 'romeo', 'sierra', 'tango',
  'uniform', 'victor', 'whiskey', 'xray', 'yankee', 'zulu', 'anchor', 'bridge', 'canvas',
  'drift', 'ember', 'frost', 'grove', 'harbor', 'inbox', 'juniper', 'kelp', 'ledger',
];

function pickWord(random) {
  return WORDS[Math.floor(random() * WORDS.length)];
}

export function noteDocName(index) {
  return `perf-note-${String(index).padStart(3, '0')}`;
}

export function noteFilename(index) {
  return `${noteDocName(index)}.md`;
}

export function mermaidBlock(random, diagramIndex) {
  const nodeCount = 4 + Math.floor(random() * 5);
  const lines = ['```mermaid', 'flowchart TD'];
  for (let n = 0; n < nodeCount; n += 1) {
    const from = `${pickWord(random)}${diagramIndex}${n}`;
    const to = `${pickWord(random)}${diagramIndex}${n + 1}`;
    lines.push(`    ${from} --> ${to}`);
  }
  lines.push('```');
  return lines.join('\n');
}

export function noteMarkdown(random, index, noteCount = DEFAULT_NOTE_COUNT) {
  const paragraphWords = [];
  for (let w = 0; w < 60; w += 1) paragraphWords.push(pickWord(random));
  const linkTarget = noteDocName(Math.floor(random() * noteCount));
  return [
    `# Perf note ${index}`,
    '',
    paragraphWords.join(' '),
    '',
    `See also [[${linkTarget}]].`,
    '',
  ].join('\n');
}

export function mermaidDocMarkdown(random, diagramCount = DEFAULT_MERMAID_DIAGRAM_COUNT) {
  const parts = ['# Perf mermaid doc', ''];
  for (let d = 0; d < diagramCount; d += 1) {
    parts.push(`## Diagram ${d + 1}`, '', mermaidBlock(random, d), '');
  }
  return parts.join('\n');
}

export function fixturePlan({
  seed = DEFAULT_SEED,
  noteCount = DEFAULT_NOTE_COUNT,
  diagramCount = DEFAULT_MERMAID_DIAGRAM_COUNT,
} = {}) {
  return { seed, noteCount, diagramCount, mermaidDocName: MERMAID_DOC_NAME };
}

export function renderFixtureFiles(plan) {
  const random = mulberry32(plan.seed);
  const files = new Map();
  for (let i = 0; i < plan.noteCount; i += 1) {
    files.set(noteFilename(i), noteMarkdown(random, i, plan.noteCount));
  }
  files.set(`${plan.mermaidDocName}.md`, mermaidDocMarkdown(random, plan.diagramCount));
  return files;
}

export function writeFixture(vaultDir, plan = fixturePlan()) {
  mkdirSync(vaultDir, { recursive: true });
  const files = renderFixtureFiles(plan);
  for (const [name, body] of files) {
    writeFileSync(join(vaultDir, name), body, 'utf-8');
  }
  return { dir: vaultDir, plan, fileCount: files.size };
}
