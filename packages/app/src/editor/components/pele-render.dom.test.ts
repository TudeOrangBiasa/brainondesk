import { describe, expect, test, vi } from 'vitest';

vi.doMock('./pele-loader.ts', () => ({
  loadPeleLazy: vi.fn(async () => ({
    detectType: (chart: string) => (chart.startsWith('graph') ? 'flowchart' : null),
    render: (chart: string) => {
      if (chart === 'graph boom') {
        throw Object.assign(new Error('bad graph'), { code: 'syntax' });
      }
      return {
        svg: '<svg viewBox="0 0 10 10"><path d="M0,0L1,1"/></svg>',
        width: 10,
        height: 10,
        type: 'flowchart',
        mermaidType: 'flowchart-v2',
        links: [],
      };
    },
  })),
  ensurePeleDiagram: vi.fn(async (type: unknown) => type !== null),
}));

const { renderDiagramWithPele, sanitizeDiagramSvg } = await import('./pele-render.ts');

describe('sanitizeDiagramSvg', () => {
  test('strips script payloads while keeping shapes', () => {
    const out = sanitizeDiagramSvg(
      '<svg viewBox="0 0 10 10"><script>alert(1)</script><path d="M0,0L1,1"/></svg>',
    );
    expect(out).not.toContain('<script');
    expect(out).toContain('<path');
  });
});

describe('renderDiagramWithPele', () => {
  test('renders a supported chart to sanitized svg', async () => {
    const outcome = await renderDiagramWithPele('graph TD');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.svg).toContain('<svg');
      expect(outcome.type).toBe('flowchart');
    }
  });

  test('reports unknown charts as unsupported', async () => {
    const outcome = await renderDiagramWithPele('hello world');
    expect(outcome).toMatchObject({ ok: false, unsupported: true });
  });

  test('reports syntax errors as non-unsupported failures', async () => {
    const outcome = await renderDiagramWithPele('graph boom');
    expect(outcome).toMatchObject({ ok: false, unsupported: false });
  });
});
