export type OfficeDocTypeId = 'docs' | 'sheets' | 'slides';

export interface OfficeDocType {
  readonly id: OfficeDocTypeId;
  readonly exts: ReadonlySet<string>;
  readonly label: 'Docs' | 'Sheets' | 'Slides';
  readonly icon: 'docs' | 'sheets' | 'slides';
}

export const OFFICE_DOC_TYPES: Record<OfficeDocTypeId, OfficeDocType> = {
  docs: { id: 'docs', exts: new Set(['docx', 'doc', 'odt']), label: 'Docs', icon: 'docs' },
  sheets: { id: 'sheets', exts: new Set(['xlsx', 'xls', 'ods']), label: 'Sheets', icon: 'sheets' },
  slides: { id: 'slides', exts: new Set(['pptx', 'ppt', 'odp']), label: 'Slides', icon: 'slides' },
};

export function officeDocTypeOf(path: string): OfficeDocType | null {
  const lastDot = path.lastIndexOf('.');
  if (lastDot < 0) return null;
  const ext = path.slice(lastDot + 1).toLowerCase();
  if (ext.length === 0) return null;
  for (const docType of Object.values(OFFICE_DOC_TYPES)) {
    if (docType.exts.has(ext)) return docType;
  }
  return null;
}

export function isOfficeDocFile(path: string): boolean {
  return officeDocTypeOf(path) !== null;
}
