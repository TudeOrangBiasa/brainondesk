import { Trans } from '@lingui/react/macro';
import { useEffect } from 'react';
import type { OfficeEditorProps } from '@/office/office-editor';

function OfficeStubShell({
  kind,
  path,
  bytes,
  onDirtyChange,
}: OfficeEditorProps & { kind: 'docs' | 'sheets' | 'slides' }) {
  useEffect(() => {
    onDirtyChange(false);
  }, [onDirtyChange]);
  return (
    <main
      className="flex h-full min-h-0 flex-col items-center justify-center gap-1 p-4 text-center"
      aria-label={path}
      data-office-editor={kind}
      data-office-path={path}
    >
      <div className="text-2xl font-light tracking-tight">
        {kind === 'docs' ? (
          <Trans>Docs editor</Trans>
        ) : kind === 'sheets' ? (
          <Trans>Sheets editor</Trans>
        ) : (
          <Trans>Slides editor</Trans>
        )}
      </div>
      <div className="text-sm text-muted-foreground">
        {path} · {bytes.byteLength} B
      </div>
    </main>
  );
}

export function OfficeDocsEditor(props: OfficeEditorProps) {
  return <OfficeStubShell kind="docs" {...props} />;
}
