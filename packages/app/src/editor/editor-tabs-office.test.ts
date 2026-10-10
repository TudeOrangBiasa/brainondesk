import { describe, expect, test } from 'vitest';
import {
  assetTabId,
  officeTabId,
  parseEditorTabId,
  parseEditorTabSessionState,
  tabIdForNavigationTarget,
} from '@/editor/editor-tabs';

describe('office tab id codec', () => {
  test('office navigation target maps to the office tab id', () => {
    expect(
      tabIdForNavigationTarget({
        kind: 'office',
        target: 'docs/spec.docx',
        officePath: 'docs/spec.docx',
        mediaKind: null,
      }),
    ).toBe(officeTabId('docs/spec.docx'));
  });

  test('office tab id parses back to the office path', () => {
    expect(parseEditorTabId(officeTabId('docs/spec.docx'))).toEqual({
      kind: 'office',
      officePath: 'docs/spec.docx',
    });
  });

  test('office tab id differs from the asset tab id for the same path', () => {
    expect(officeTabId('docs/spec.docx')).not.toBe(assetTabId('docs/spec.docx'));
  });

  test('office tab restores verbatim after persist round-trip', () => {
    const state = parseEditorTabSessionState({
      panes: [
        {
          id: 'pane-main',
          openTabs: [officeTabId('docs/spec.docx')],
          pinnedTabIds: [],
          activeTabId: officeTabId('docs/spec.docx'),
          size: 100,
        },
      ],
      focusedPaneId: 'pane-main',
    });
    expect(state.panes[0].openTabs).toEqual([officeTabId('docs/spec.docx')]);
    expect(state.panes[0].activeTabId).toBe(officeTabId('docs/spec.docx'));
  });
});
