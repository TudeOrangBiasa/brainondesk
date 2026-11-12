// @vitest-environment jsdom

import type { Block } from '@inkeep/open-knowledge-office-docx';
import { buildBlankDocx } from '@inkeep/open-knowledge-office-docx';
import { describe, expect, test } from 'vitest';
import { blocksToTipTapDoc, docxToTipTapDoc } from './docx-to-tiptap';

function textBlock(text: string, marks?: { bold?: true }): Block {
  return {
    id: 'p1',
    type: 'paragraph',
    docxIndex: null,
    originalXml: null,
    runs: [{ text, bold: marks?.bold }],
  };
}

describe('blocksToTipTapDoc', () => {
  test('maps paragraph, heading, bullet, table, bold', () => {
    const doc = blocksToTipTapDoc([
      textBlock('Hello'),
      {
        id: 'h1',
        type: 'heading',
        level: 2,
        docxIndex: null,
        originalXml: null,
        runs: [{ text: 'Judul' }],
      },
      {
        id: 'l1',
        type: 'listItem',
        docxIndex: null,
        originalXml: null,
        list: { kind: 'bullet', numId: '1', ilvl: 0 },
        runs: [{ text: 'item' }],
      },
      {
        id: 't1',
        type: 'table',
        docxIndex: null,
        originalXml: null,
        table: { rows: [[{ paras: ['a'] }, { paras: ['b'] }]] },
      },
      textBlock('tebal', { bold: true }),
    ]);
    expect(doc).toEqual({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Judul' }] },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'item' }] }],
            },
          ],
        },
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a' }] }],
                },
                {
                  type: 'tableCell',
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'b' }] }],
                },
              ],
            },
          ],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'tebal' }],
        },
      ],
    });
  });
});

describe('docxToTipTapDoc', () => {
  test('blank template parses to an empty doc', async () => {
    const bytes = await buildBlankDocx();
    const doc = await docxToTipTapDoc(bytes.buffer as ArrayBuffer);
    expect(doc).toEqual({ type: 'doc', content: [] });
  });
});
