// @vitest-environment jsdom
import { buildBlankDocx, parseDocx, saveDocx } from '@inkeep/open-knowledge-office-docx';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { OfficeDocsEditor } from './OfficeDocsEditor';

async function fixtureDocx(): Promise<ArrayBuffer> {
  const blank = await buildBlankDocx();
  const parsed = await parseDocx(blank);
  const bytes = await saveDocx(parsed, [
    { kind: 'generated', block: { type: 'heading', level: 1, runs: [{ text: 'Halo docs' }] } },
    { kind: 'generated', block: { type: 'paragraph', runs: [{ text: 'isi paragraf' }] } },
  ]);
  return bytes.buffer as ArrayBuffer;
}

describe('OfficeDocsEditor read-only render', () => {
  test('renders parsed docx text without console errors', async () => {
    const errors: unknown[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      errors.push(args);
    });
    try {
      const onDirtyChange = vi.fn();
      const onSave = vi.fn();
      render(
        <OfficeDocsEditor
          path="docs/fixture.docx"
          bytes={await fixtureDocx()}
          readOnly
          onSave={onSave}
          onDirtyChange={onDirtyChange}
        />,
      );
      await waitFor(() => {
        expect(screen.getByText('Halo docs')).toBeTruthy();
      });
      expect(screen.getByText('isi paragraf')).toBeTruthy();
      expect(onDirtyChange).toHaveBeenCalledWith(false);
      expect(onSave).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
    expect(errors).toEqual([]);
  });
});
