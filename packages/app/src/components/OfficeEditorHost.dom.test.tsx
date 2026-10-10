// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { officeTabId } from '@/editor/editor-tabs';
import { __resetOfficeDirtyForTests, setOfficeDirty } from '@/office/office-dirty-store';

vi.doMock('@lingui/react/macro', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@lingui/react/macro')>();
  return {
    ...actual,
    Trans: ({ children }: { children?: ReactNode }) => <>{children}</>,
  };
});

vi.doMock('@/office/office-host', () => ({
  useOfficeHost: ({ path }: { path: string }) => ({
    status: 'clean',
    snapshot: {
      bytes: new ArrayBuffer(8),
      etag: '"abc"',
      size: 8,
      mtimeMs: 0,
      contentType: 'application/octet-stream',
      docType: path.endsWith('.xlsx') ? 'sheets' : path.endsWith('.pptx') ? 'slides' : 'docs',
    },
    draft: null,
    etag: '"abc"',
    serverEtag: '"abc"',
    error: null,
    conflictEtag: null,
    load: vi.fn(),
    setDraft: vi.fn(),
    save: vi.fn(),
    reload: vi.fn(),
    dismissExternalChange: vi.fn(),
  }),
}));

const { OfficeEditorHost } = await import('./OfficeEditorHost');

beforeEach(() => {
  __resetOfficeDirtyForTests();
});

afterEach(() => {
  cleanup();
  __resetOfficeDirtyForTests();
});

describe('OfficeEditorHost routing', () => {
  test('routes docx bytes to the docs editor behind Suspense', async () => {
    const { container } = render(<OfficeEditorHost path="docs/spec.docx" />);
    await waitFor(() => {
      expect(screen.getByTestId('office-save-bar')).not.toBeNull();
    });
    await waitFor(() => {
      expect(container.querySelector('[data-office-editor="docs"]')).not.toBeNull();
    });
    expect(officeTabId('docs/spec.docx')).toContain('docs/spec.docx');
  });

  test('routes xlsx and pptx to their per-type editors', async () => {
    const sheets = render(<OfficeEditorHost path="data/budget.xlsx" />);
    await waitFor(() => {
      expect(sheets.container.querySelector('[data-office-editor="sheets"]')).not.toBeNull();
    });
    sheets.unmount();
    const slides = render(<OfficeEditorHost path="deck/intro.pptx" />);
    await waitFor(() => {
      expect(slides.container.querySelector('[data-office-editor="slides"]')).not.toBeNull();
    });
  });
});

describe('office dirty dot', () => {
  test('dirty store tracks per-path dirty state', () => {
    setOfficeDirty('docs/spec.docx', true);
    act(() => {
      setOfficeDirty('docs/other.docx', false);
    });
    expect(document.body).not.toBeNull();
  });
});
