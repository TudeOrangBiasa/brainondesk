import DOMPurify from 'dompurify';
import type { DiagramType, RenderResult } from 'pele/lazy';
import { ensurePeleDiagram, loadPeleLazy } from './pele-loader.ts';

export interface PeleRenderSuccess {
  ok: true;
  svg: string;
  width: number;
  height: number;
  type: DiagramType;
}

export interface PeleRenderFailure {
  ok: false;
  unsupported: boolean;
  message: string;
}

export type PeleRenderOutcome = PeleRenderSuccess | PeleRenderFailure;

const PELE_FONT_FAMILY = '"Inter Variable", ui-sans-serif, system-ui, sans-serif';
const PELE_FONT_FAMILY_MONO = '"JetBrains Mono Variable", ui-monospace, monospace';

export function sanitizeDiagramSvg(svg: string): string {
  return DOMPurify.sanitize(svg, { FORBID_TAGS: ['style'] }).toString();
}

function successOf(result: RenderResult): PeleRenderSuccess {
  return {
    ok: true,
    svg: sanitizeDiagramSvg(result.svg),
    width: result.width,
    height: result.height,
    type: result.type,
  };
}

export async function renderDiagramWithPele(chart: string): Promise<PeleRenderOutcome> {
  const pele = await loadPeleLazy();
  const type = pele.detectType(chart);
  if (!(await ensurePeleDiagram(type))) {
    return {
      ok: false,
      unsupported: true,
      message: type === null ? 'No diagram type detected.' : `Unsupported diagram: ${type}.`,
    };
  }
  try {
    return successOf(
      pele.render(chart, {
        fontFamily: PELE_FONT_FAMILY,
        fontFamilyMono: PELE_FONT_FAMILY_MONO,
      }),
    );
  } catch (err) {
    const code = err !== null && typeof err === 'object' && 'code' in err ? err.code : undefined;
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, unsupported: code === 'unsupported-diagram', message };
  }
}
