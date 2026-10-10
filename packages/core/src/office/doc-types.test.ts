import { describe, expect, test } from 'vitest';
import { isExcalidrawDocFile, isMermaidDocFile } from '../constants/upload.ts';
import { isOfficeDocFile, OFFICE_DOC_TYPES, officeDocTypeOf } from './doc-types.ts';

describe('office doc-type registry', () => {
  test('OFFICE_DOC_TYPES covers docs, sheets, and slides', () => {
    expect(Object.keys(OFFICE_DOC_TYPES).sort()).toEqual(['docs', 'sheets', 'slides']);
    expect(OFFICE_DOC_TYPES.docs.label).toBe('Docs');
    expect(OFFICE_DOC_TYPES.sheets.label).toBe('Sheets');
    expect(OFFICE_DOC_TYPES.slides.label).toBe('Slides');
    expect(OFFICE_DOC_TYPES.docs.icon).toBe('docs');
    expect(OFFICE_DOC_TYPES.sheets.icon).toBe('sheets');
    expect(OFFICE_DOC_TYPES.slides.icon).toBe('slides');
  });

  test.each([
    ['report.docx', 'docs'],
    ['legacy.doc', 'docs'],
    ['notes.odt', 'docs'],
    ['budget.xlsx', 'sheets'],
    ['legacy.xls', 'sheets'],
    ['table.ods', 'sheets'],
    ['deck.pptx', 'slides'],
    ['legacy.ppt', 'slides'],
    ['slides.odp', 'slides'],
  ] as const)('officeDocTypeOf(%s) resolves %s', (path, id) => {
    expect(officeDocTypeOf(path)?.id).toBe(id);
    expect(isOfficeDocFile(path)).toBe(true);
  });

  test('detection is case-insensitive on the trailing extension', () => {
    expect(officeDocTypeOf('docs/REPORT.DOCX')?.id).toBe('docs');
    expect(officeDocTypeOf('docs/Budget.XlSx')?.id).toBe('sheets');
    expect(officeDocTypeOf('docs/DECK.PptX')?.id).toBe('slides');
    expect(isOfficeDocFile('docs/REPORT.DOCX')).toBe(true);
  });

  test('matches by trailing extension only', () => {
    expect(officeDocTypeOf('docs/report.docx')).not.toBeNull();
    expect(officeDocTypeOf('docs/report')).toBeNull();
    expect(officeDocTypeOf('docs/report.')).toBeNull();
    expect(officeDocTypeOf('docs/archive.docx.zip')).toBeNull();
  });

  test.each(['notes.md', 'notes.mdx', 'board.excalidraw', 'flow.mmd', 'photo.png', 'data.csv'])(
    'non-office path %s is negative',
    (path) => {
      expect(isOfficeDocFile(path)).toBe(false);
      expect(officeDocTypeOf(path)).toBeNull();
    },
  );

  test('csv stays editable text, not office', () => {
    expect(isOfficeDocFile('data.csv')).toBe(false);
  });

  test('isExcalidrawDocFile behavior is unchanged', () => {
    expect(isExcalidrawDocFile('assets/board.excalidraw')).toBe(true);
    expect(isExcalidrawDocFile('board.EXCALIDRAW')).toBe(true);
    expect(isExcalidrawDocFile('board.canvas')).toBe(false);
    expect(isExcalidrawDocFile('board.mmd')).toBe(false);
    expect(isExcalidrawDocFile('board')).toBe(false);
    expect(isOfficeDocFile('assets/board.excalidraw')).toBe(false);
    expect(isOfficeDocFile('board.EXCALIDRAW')).toBe(false);
  });

  test('excalidraw and mermaid files are not office docs', () => {
    expect(officeDocTypeOf('assets/board.excalidraw')).toBeNull();
    expect(isMermaidDocFile('assets/flow.mmd')).toBe(true);
    expect(officeDocTypeOf('assets/flow.mmd')).toBeNull();
  });
});
