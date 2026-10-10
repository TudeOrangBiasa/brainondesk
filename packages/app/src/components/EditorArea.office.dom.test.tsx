// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

let docCtx: {
  activeDocName: null;
  activeProvider: null;
  activeTarget: { kind: 'office'; target: string; officePath: string; mediaKind: null };
  recycleDocument: () => void;
  closeActivityPanel: () => void;
  docPanelMode: string;
  docPanelAgentId: null;
  docPanelExpandSignal: number;
} | null = null;

vi.doMock('@/lib/perf', () => ({
  mark: () => {},
  ProfilerBoundary: ({ children }: { children: ReactNode }) => children,
}));

vi.doMock('@/components/PropertyContext', () => ({
  PropertyProvider: ({ children }: { children: ReactNode }) => children,
  useProperties: () => ({ requestAddProperty: () => {} }),
}));

vi.doMock('@/lib/config-provider', () => ({
  useConfigContext: () => ({ projectBinding: null }),
}));

vi.doMock('@/editor/DocumentContext', () => ({
  useDocumentContext: () => docCtx,
  useDocumentTransition: () => ({ openDocumentTransition: null }),
  isBlobRunnerNewTabId: () => false,
}));

vi.doMock('@/components/EmptyEditorState', () => ({
  EmptyEditorState: () => <div data-testid="empty-editor-state" />,
}));

vi.doMock('@/components/EditorSkeleton', () => ({
  EditorSkeleton: () => <div data-testid="editor-skeleton" />,
}));

vi.doMock('./TerminalDock', () => ({
  TerminalDock: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.doMock('./EditorWorkspace', () => ({
  EditorWorkspace: ({
    renderPane,
  }: {
    renderPane: (context: {
      pane: { id: string };
      isFocused: boolean;
      activityDocName: null;
    }) => ReactNode;
  }) => <>{renderPane({ pane: { id: 'pane-test' }, isFocused: true, activityDocName: null })}</>,
}));

vi.doMock('@/components/settings/SettingsDialogShell', () => ({
  SettingsDialogShell: () => <div data-testid="settings-shell" />,
}));

vi.doMock('@/lib/use-settings-route', () => ({
  useSettingsRoute: () => ({ open: false, close: () => {} }),
}));

vi.doMock('@/hooks/use-doc-panel-layout', () => ({
  useDocPanelLayout: () => ({ layout: 'panel', autoCollapse: false }),
}));

vi.doMock('@/hooks/use-document-stats', () => ({
  useDocumentStats: () => null,
}));

vi.doMock('@/hooks/use-conflicts', () => ({
  useDocConflict: () => null,
  useConflicts: () => ({ conflicts: [], loading: false, error: null, refresh: () => {} }),
}));

vi.doMock('@/presence/use-sync-status', () => ({
  useSyncStatus: () => 'synced',
}));

vi.doMock('@/components/FolderOverview', () => ({
  FolderOverview: () => <div data-testid="folder-overview" />,
}));

vi.doMock('./BottomComposer', () => ({
  BottomComposer: () => <div data-testid="bottom-composer" />,
}));

vi.doMock('@/components/ActivityModeContent', () => ({
  ActivityModeContent: () => <div data-testid="activity-mode-content" />,
}));

vi.doMock('@/components/AssetPreview', () => ({
  AssetPreview: () => <div data-testid="asset-preview" />,
}));

vi.doMock('@/components/LargeFileEditorState', () => ({
  LargeFileEditorState: () => <div data-testid="large-file-state" />,
}));

vi.doMock('./EditorFooter', () => ({
  EditorFooter: () => <div data-testid="editor-footer" />,
}));

vi.doMock('@/components/OfficeEditorHost', () => ({
  OfficeEditorHost: ({ path }: { path: string }) => (
    <div data-testid="office-editor-host" data-path={path} />
  ),
}));

const { EditorArea } = await import('./EditorArea');

function officeCtx(officePath: string) {
  return {
    activeDocName: null,
    activeProvider: null,
    activeTarget: { kind: 'office', target: officePath, officePath, mediaKind: null },
    recycleDocument: () => {},
    closeActivityPanel: () => {},
    docPanelMode: 'timeline',
    docPanelAgentId: null,
    docPanelExpandSignal: 0,
  } as const;
}

beforeEach(() => {
  cleanup();
});

afterEach(() => {
  cleanup();
  docCtx = null;
});

describe('EditorArea office routing', () => {
  test('focused office target mounts the lazy office host', async () => {
    docCtx = { ...officeCtx('docs/spec.docx') };
    render(
      <EditorArea
        editorMode="wysiwyg"
        onModeChange={() => {}}
        activeTab="timeline"
        onActiveTabChange={() => {}}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId('office-editor-host')).not.toBeNull();
    });
    expect(screen.getByTestId('office-editor-host').getAttribute('data-path')).toBe(
      'docs/spec.docx',
    );
  });
});
