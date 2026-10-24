import type { Config } from '@inkeep/open-knowledge-core/config/schema';

export type DiagramRenderer = 'pele' | 'mermaid';

type EditorConfig = Config['editor'] & { diagramRenderer?: unknown };

export function resolveDiagramRenderer(editor?: Config['editor'] | null): DiagramRenderer {
  const override = (editor as EditorConfig | null | undefined)?.diagramRenderer;
  return override === 'mermaid' ? 'mermaid' : 'pele';
}
