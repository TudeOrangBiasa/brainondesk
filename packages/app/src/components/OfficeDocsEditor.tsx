import { Trans } from '@lingui/react/macro';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TipTapDoc } from '@/office/docx-to-tiptap';
import { docxToTipTapDoc } from '@/office/docx-to-tiptap';
import type { OfficeEditorProps } from '@/office/office-editor';

export function OfficeDocsEditor({ path, bytes, readOnly, onDirtyChange }: OfficeEditorProps) {
  const [portalTarget] = useState(() => document.createElement('div'));
  const [doc, setDoc] = useState<TipTapDoc | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    onDirtyChange(false);
  }, [onDirtyChange]);
  useEffect(() => {
    let cancelled = false;
    setDoc(null);
    setFailed(false);
    void docxToTipTapDoc(bytes).then(
      (next) => {
        if (!cancelled) setDoc(next);
      },
      () => {
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [bytes]);
  const editor = useEditor(
    {
      extensions: [StarterKit],
      content: doc ?? undefined,
      editable: !readOnly,
      immediatelyRender: false,
    },
    [doc],
  );
  if (failed || doc === null) {
    return (
      <main
        className="flex h-full min-h-0 flex-col items-center justify-center gap-1 p-4 text-center"
        aria-label={path}
        data-office-editor="docs"
        data-office-path={path}
      >
        <div className="text-sm text-muted-foreground">
          {failed ? (
            <Trans>Failed to render this .docx file.</Trans>
          ) : (
            <Trans>Loading document</Trans>
          )}
        </div>
      </main>
    );
  }
  return (
    <main
      className="h-full min-h-0 overflow-y-auto p-4"
      aria-label={path}
      data-office-editor="docs"
      data-office-path={path}
      ref={(slot) => {
        if (slot !== null && portalTarget.parentNode !== slot) slot.appendChild(portalTarget);
      }}
    >
      {createPortal(
        // oxlint-disable-next-line ok/no-unportaled-editor-content -- per-tab portal target — H6 fix per PRECEDENTS.md #44
        <EditorContent editor={editor} />,
        portalTarget,
      )}
    </main>
  );
}
