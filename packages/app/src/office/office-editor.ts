export interface OfficeEditorProps {
  path: string;
  bytes: ArrayBuffer;
  readOnly: boolean;
  onSave: (bytes: ArrayBuffer) => void;
  onDirtyChange: (dirty: boolean) => void;
}
