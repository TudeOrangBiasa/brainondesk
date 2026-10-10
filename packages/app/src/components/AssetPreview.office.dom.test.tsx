import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

const dispatchAssetClickStub = vi.fn(async () => {});
vi.doMock('@/editor/asset-dispatch', () => ({
  dispatchAssetClick: dispatchAssetClickStub,
}));

vi.doMock('@/lib/config-provider', () => ({
  useConfigContext: () => ({
    merged: null,
    projectLocalBinding: null,
  }),
}));

const { AssetPreview } = await import('./AssetPreview.tsx');

describe('AssetPreview — office placeholder', () => {
  afterEach(() => {
    cleanup();
    dispatchAssetClickStub.mockClear();
  });

  test('a docx asset renders the Docs editor placeholder', () => {
    const { container } = render(<AssetPreview assetPath="docs/report.docx" mediaKind={null} />);
    expect(container.textContent).toContain('Docs editor');
    expect(container.querySelector('[data-text-viewer]')).toBeNull();
  });

  test('xlsx and pptx assets render their editor placeholders', () => {
    for (const [path, label] of [
      ['sheets/budget.xlsx', 'Sheets editor'],
      ['slides/deck.pptx', 'Slides editor'],
    ] as const) {
      const { container, unmount } = render(<AssetPreview assetPath={path} mediaKind={null} />);
      expect(container.textContent).toContain(label);
      expect(container.querySelector('[data-text-viewer]')).toBeNull();
      unmount();
    }
  });

  test('the placeholder keeps the Open file fallback', () => {
    const { container } = render(<AssetPreview assetPath="docs/report.docx" mediaKind={null} />);
    const openFileBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      /open file/i.test(b.textContent ?? ''),
    );
    expect(openFileBtn).not.toBeUndefined();
    fireEvent.click(openFileBtn as HTMLButtonElement);
    expect(dispatchAssetClickStub).toHaveBeenCalledTimes(1);
    expect(dispatchAssetClickStub.mock.calls[0]?.[0]).toMatchObject({
      projectRelPath: 'docs/report.docx',
      ext: 'docx',
    });
  });
});
