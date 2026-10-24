import { describe, expect, test } from 'vitest';
import { resolveDiagramRenderer } from './diagram-renderer.ts';

describe('resolveDiagramRenderer', () => {
  test('defaults to pele when editor config is absent', () => {
    expect(resolveDiagramRenderer(null)).toBe('pele');
    expect(resolveDiagramRenderer(undefined)).toBe('pele');
  });

  test('defaults to pele when the key is absent', () => {
    expect(resolveDiagramRenderer({ wordWrap: true, previewTabs: true })).toBe('pele');
  });

  test('honors an explicit mermaid opt-out', () => {
    expect(
      resolveDiagramRenderer({
        wordWrap: true,
        previewTabs: true,
        diagramRenderer: 'mermaid',
      }),
    ).toBe('mermaid');
  });

  test('treats unknown values as pele', () => {
    expect(
      resolveDiagramRenderer({
        wordWrap: true,
        previewTabs: true,
        diagramRenderer: 'graphviz',
      }),
    ).toBe('pele');
  });
});
