import { Trans } from '@lingui/react/macro';
import { useEffect } from 'react';
import type { OfficeEditorProps } from '@/office/office-editor';

export function OfficeSheetsEditor({ path, bytes, onDirtyChange }: OfficeEditorProps) {
  useEffect(() => {
    onDirtyChange(false);
  }, [onDirtyChange]);
  return (
    <main
      className="flex h-full min-h-0 flex-col items-center justify-center gap-1 p-4 text-center"
      aria-label={path}
      data-office-editor="sheets"
      data-office-path={path}
    >
      <div className="text-2xl font-light tracking-tight">
        <Trans>Sheets editor</Trans>
      </div>
      <div className="text-sm text-muted-foreground">
        {path} · {bytes.byteLength} B
      </div>
    </main>
  );
}
