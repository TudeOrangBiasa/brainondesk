import { officeDocTypeOf } from '@inkeep/open-knowledge-core/office/doc-types';
import { Trans } from '@lingui/react/macro';
import { lazy, Suspense, useEffect } from 'react';
import { EditorSkeleton } from '@/components/EditorSkeleton';
import { Button } from '@/components/ui/button';
import { setOfficeDirty } from '@/office/office-dirty-store';
import type { OfficeEditorProps } from '@/office/office-editor';
import type { UseOfficeHost } from '@/office/office-host';
import { useOfficeHost } from '@/office/office-host';

const OfficeDocsEditor = lazy(async () => ({
  default: (await import('./OfficeDocsEditor')).OfficeDocsEditor,
}));
const OfficeSheetsEditor = lazy(async () => ({
  default: (await import('./OfficeSheetsEditor')).OfficeSheetsEditor,
}));
const OfficeSlidesEditor = lazy(async () => ({
  default: (await import('./OfficeSlidesEditor')).OfficeSlidesEditor,
}));

export function OfficeEditorHost({ path }: { path: string }) {
  const host = useOfficeHost({ path });
  useEffect(() => {
    setOfficeDirty(path, host.status === 'dirty' || host.status === 'saving');
  }, [path, host.status]);
  if (host.status === 'loading' || host.status === 'idle') {
    return <EditorSkeleton />;
  }
  if (host.status === 'error' || host.snapshot === null) {
    return (
      <main
        className="flex h-full min-h-0 flex-col items-center justify-center gap-2 p-4 text-center"
        aria-label={path}
        role="alert"
      >
        <div className="text-sm">{host.error ?? <Trans>Failed to load office file</Trans>}</div>
        <Button onClick={() => host.load()} data-testid="office-editor-retry">
          <Trans>Retry</Trans>
        </Button>
      </main>
    );
  }
  return (
    <main
      className="flex h-full min-h-0 flex-col bg-background"
      aria-label={path}
      data-office-editor-host={path}
    >
      <OfficeSaveBar path={path} host={host} />
      <div className="min-h-0 flex-1">
        <Suspense fallback={<EditorSkeleton />}>
          <OfficePerTypeEditor
            path={path}
            host={host}
            bytes={host.snapshot.bytes}
            onSave={(bytes) => host.setDraft(bytes)}
            onDirtyChange={(dirty) => setOfficeDirty(path, dirty)}
          />
        </Suspense>
      </div>
    </main>
  );
}

function OfficeSaveBar({ path, host }: { path: string; host: UseOfficeHost }) {
  const dirty = host.status === 'dirty' || host.status === 'saving';
  return (
    <div
      className="flex items-center gap-2 border-b px-3 py-2 text-sm"
      data-testid="office-save-bar"
    >
      <span className="font-medium">{path.slice(path.lastIndexOf('/') + 1)}</span>
      <span className="text-muted-foreground" data-testid="office-save-status">
        {host.status === 'saving' ? (
          <Trans>Saving</Trans>
        ) : host.status === 'conflict' ? (
          <Trans>Conflict — file changed on disk</Trans>
        ) : host.status === 'externally-changed' ? (
          <Trans>Changed on disk</Trans>
        ) : dirty ? (
          <Trans>Unsaved changes</Trans>
        ) : (
          <Trans>Saved</Trans>
        )}
      </span>
      {host.status === 'conflict' || host.status === 'externally-changed' ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => host.reload()}
          data-testid="office-editor-reload"
        >
          <Trans>Reload</Trans>
        </Button>
      ) : null}
      <Button
        size="sm"
        disabled={!dirty}
        onClick={() => host.save()}
        data-testid="office-editor-save"
      >
        <Trans>Save</Trans>
      </Button>
    </div>
  );
}

function OfficePerTypeEditor({
  path,
  host,
  bytes,
  onSave,
  onDirtyChange,
}: {
  path: string;
  host: UseOfficeHost;
  bytes: ArrayBuffer;
  onSave: OfficeEditorProps['onSave'];
  onDirtyChange: OfficeEditorProps['onDirtyChange'];
}) {
  const docType = officeDocTypeOf(path)?.id ?? host.snapshot?.docType ?? 'docs';
  const readOnly = false;
  if (docType === 'sheets') {
    return (
      <OfficeSheetsEditor
        path={path}
        bytes={bytes}
        readOnly={readOnly}
        onSave={onSave}
        onDirtyChange={onDirtyChange}
      />
    );
  }
  if (docType === 'slides') {
    return (
      <OfficeSlidesEditor
        path={path}
        bytes={bytes}
        readOnly={readOnly}
        onSave={onSave}
        onDirtyChange={onDirtyChange}
      />
    );
  }
  return (
    <OfficeDocsEditor
      path={path}
      bytes={bytes}
      readOnly={readOnly}
      onSave={onSave}
      onDirtyChange={onDirtyChange}
    />
  );
}
