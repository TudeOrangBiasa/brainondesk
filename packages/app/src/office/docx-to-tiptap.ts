import type { Block } from '@inkeep/open-knowledge-office-docx';
import { parseDocx } from '@inkeep/open-knowledge-office-docx';

export interface TipTapMark {
  type: 'bold' | 'italic' | 'underline' | 'strike' | 'link';
  attrs?: Record<string, string | number>;
}

export interface TipTapNode {
  type: string;
  attrs?: Record<string, string | number>;
  marks?: TipTapMark[];
  text?: string;
  content?: TipTapNode[];
}

export interface TipTapDoc {
  type: 'doc';
  content: TipTapNode[];
}

export function blocksToTipTapDoc(blocks: readonly Block[]): TipTapDoc {
  const content: TipTapNode[] = [];
  for (const block of blocks) {
    if (block.hidden === true) continue;
    const inline = (block.runs ?? []).map((run): TipTapNode => {
      const marks: TipTapMark[] = [];
      if (run.bold === true) marks.push({ type: 'bold' });
      if (run.italic === true) marks.push({ type: 'italic' });
      if (run.underline === true) marks.push({ type: 'underline' });
      if (run.strike === true) marks.push({ type: 'strike' });
      if (run.link !== undefined) marks.push({ type: 'link', attrs: { href: run.link.href } });
      return marks.length > 0
        ? { type: 'text', text: run.text, marks }
        : { type: 'text', text: run.text };
    });
    switch (block.type) {
      case 'paragraph':
        if (inline.length > 0) content.push({ type: 'paragraph', content: inline });
        break;
      case 'heading':
        content.push({
          type: 'heading',
          attrs: { level: Math.min(Math.max(block.level ?? 1, 1), 6) },
          content: inline,
        });
        break;
      case 'listItem':
        content.push({
          type: block.list?.kind === 'ordered' ? 'orderedList' : 'bulletList',
          content: [{ type: 'listItem', content: [{ type: 'paragraph', content: inline }] }],
        });
        break;
      case 'table':
        content.push({
          type: 'table',
          content: (block.table?.rows ?? []).map((cells) => ({
            type: 'tableRow',
            content: cells.map((cell) => ({
              type: 'tableCell',
              content: cell.paras.map((text) => ({
                type: 'paragraph',
                content: [{ type: 'text', text }],
              })),
            })),
          })),
        });
        break;
      default:
        break;
    }
  }
  return { type: 'doc', content };
}

export async function docxToTipTapDoc(bytes: ArrayBuffer): Promise<TipTapDoc> {
  const parsed = await parseDocx(new Uint8Array(bytes));
  return blocksToTipTapDoc(parsed.blocks);
}
