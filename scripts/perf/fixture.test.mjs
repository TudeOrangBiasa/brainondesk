import { describe, expect, test } from 'vitest';
import {
  DEFAULT_MERMAID_DIAGRAM_COUNT,
  DEFAULT_NOTE_COUNT,
  DEFAULT_SEED,
  MERMAID_DOC_NAME,
} from './constants.mjs';
import { fixturePlan, mermaidDocMarkdown, noteFilename, noteMarkdown, mulberry32, renderFixtureFiles } from './fixture.mjs';

describe('mulberry32', () => {
  test('same seed produces the same sequence', () => {
    const a = mulberry32(68);
    const b = mulberry32(68);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  test('different seeds diverge', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});

describe('fixturePlan', () => {
  test('defaults match the ticket fixture shape', () => {
    expect(fixturePlan()).toEqual({
      seed: DEFAULT_SEED,
      noteCount: DEFAULT_NOTE_COUNT,
      diagramCount: DEFAULT_MERMAID_DIAGRAM_COUNT,
      mermaidDocName: MERMAID_DOC_NAME,
    });
  });
});

describe('renderFixtureFiles', () => {
  test('renders 300 notes plus the mermaid doc by default', () => {
    const files = renderFixtureFiles(fixturePlan());
    expect(files.size).toBe(301);
    expect(files.has(noteFilename(0))).toBe(true);
    expect(files.has(noteFilename(299))).toBe(true);
    expect(files.has(`${MERMAID_DOC_NAME}.md`)).toBe(true);
  });

  test('is byte-identical across runs with the same seed', () => {
    const a = renderFixtureFiles(fixturePlan({ seed: 7 }));
    const b = renderFixtureFiles(fixturePlan({ seed: 7 }));
    expect([...a.entries()]).toEqual([...b.entries()]);
  });

  test('mermaid doc carries exactly 20 diagrams', () => {
    const body = mermaidDocMarkdown(mulberry32(DEFAULT_SEED));
    expect(body.match(/```mermaid/g)).toHaveLength(20);
  });

  test('notes link to other notes in range', () => {
    const files = renderFixtureFiles(fixturePlan({ seed: 3 }));
    const body = files.get(noteFilename(0));
    const target = /\[\[(perf-note-\d+)\]\]/.exec(body)[1];
    expect(files.has(`${target}.md`)).toBe(true);
  });

  test('links stay in range for a custom noteCount', () => {
    const files = renderFixtureFiles(fixturePlan({ seed: 3, noteCount: 10 }));
    expect(files.size).toBe(11);
    for (const [name, body] of files) {
      if (name === `${MERMAID_DOC_NAME}.md`) continue;
      const target = /\[\[(perf-note-\d+)\]\]/.exec(body)[1];
      expect(files.has(`${target}.md`)).toBe(true);
    }
  });

  test('note body is deterministic for a fixed seed', () => {
    expect(noteMarkdown(mulberry32(11), 5)).toBe(noteMarkdown(mulberry32(11), 5));
  });
});
