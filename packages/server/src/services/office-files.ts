import { createHash } from 'node:crypto';
import { renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { atomicTempPath } from '@inkeep/open-knowledge-core/server';
import type { DiskEvent } from '../file-watcher.ts';
import { registerWrite } from '../file-watcher.ts';
import { assertNoSymlinkEscape } from '../fs-safety.ts';
import { tracedMkdirSync } from '../fs-traced.ts';
import { contentHash } from '../version-hash.ts';

export type OfficeDocKindId = 'docs' | 'sheets' | 'slides';

const OFFICE_DOC_EXTENSION: Record<string, true> = {
  docx: true,
  xlsx: true,
  pptx: true,
  doc: true,
  xls: true,
  ppt: true,
  odt: true,
  ods: true,
  odp: true,
};

const OFFICE_KIND_BY_EXTENSION: Record<string, OfficeDocKindId> = {
  docx: 'docs',
  doc: 'docs',
  odt: 'docs',
  xlsx: 'sheets',
  xls: 'sheets',
  ods: 'sheets',
  pptx: 'slides',
  ppt: 'slides',
  odp: 'slides',
};

const OFFICE_CONTENT_TYPE: Record<string, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  doc: 'application/msword',
  xls: 'application/vnd.ms-excel',
  ppt: 'application/vnd.ms-powerpoint',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation',
};

export function isOfficeDocFile(path: string): boolean {
  return OFFICE_DOC_EXTENSION[extname(path).slice(1).toLowerCase()] === true;
}

export function officeDocTypeOf(path: string): OfficeDocKindId | null {
  const ext = extname(path).slice(1).toLowerCase();
  if (ext === '') return null;
  return OFFICE_KIND_BY_EXTENSION[ext] ?? null;
}

export function officeContentTypeForPath(path: string): string {
  return OFFICE_CONTENT_TYPE[extname(path).slice(1).toLowerCase()] ?? 'application/octet-stream';
}

export function officeEtagForBytes(bytes: Buffer, size: number, mtimeMs: number): string {
  const sha1 = createHash('sha1').update(bytes).digest('hex');
  return `W/"${sha1}-${size}-${Math.floor(mtimeMs)}"`;
}

export interface OfficeFileIndexMutation {
  kind: 'file-create' | 'file-update';
  path: string;
  relativePath: string;
  size: number;
  modifiedTs: number;
  inode: number;
}

export interface OfficeFileServiceDeps {
  contentDir: string;
  projectDir?: string | undefined;
  assertContentPath?: ((path: string) => void) | undefined;
  maxBytes?: number | undefined;
  mutateFileIndex?: ((event: DiskEvent) => void) | undefined;
  signalFiles?: (() => void) | undefined;
}

export interface OfficeFileRead {
  canonicalPath: string;
  relativePath: string;
  bytes: Buffer;
  size: number;
  mtimeMs: number;
  etag: string;
  contentType: string;
  docType: string;
}

export interface OfficeFileWrite {
  canonicalPath: string;
  relativePath: string;
  etag: string;
  size: number;
  mtimeMs: number;
  created: boolean;
}

export type OfficeResolveResult =
  | ({ ok: true } & OfficeFileRead)
  | {
      ok: false;
      reason: 'missing-path' | 'unsupported-type' | 'not-found' | 'invalid-path';
      cause?: unknown;
    };

export type OfficeWriteResult =
  | ({ ok: true } & OfficeFileWrite)
  | {
      ok: false;
      reason:
        | 'missing-path'
        | 'unsupported-type'
        | 'invalid-path'
        | 'not-found'
        | 'conflict'
        | 'payload-too-large'
        | 'write-failed';
      cause?: unknown;
      currentEtag?: string;
    };

export interface OfficeFileService {
  resolveOfficeFile: (requestedPath: string | null) => Promise<OfficeResolveResult>;
  writeOfficeFile: (
    requestedPath: string | null,
    bytes: Buffer,
    ifMatch: string | null,
  ) => Promise<OfficeWriteResult>;
}

type ConfinedPath =
  | { ok: true; fullPath: string }
  | { ok: false; reason: 'missing-path' | 'invalid-path'; cause?: unknown };

function resolveConfinedPath(
  deps: OfficeFileServiceDeps,
  requestedPath: string | null,
): ConfinedPath {
  if (requestedPath === null || requestedPath.trim() === '') {
    return { ok: false, reason: 'missing-path' };
  }
  const normalized = requestedPath.split('\\').join('/');
  if (
    normalized.includes('\x00') ||
    normalized.startsWith('/') ||
    normalized.split('/').some((seg) => seg === '..')
  ) {
    return { ok: false, reason: 'invalid-path' };
  }
  const root = resolve(deps.projectDir ?? deps.contentDir);
  const fullPath = resolve(root, normalized);
  if (fullPath !== root && !fullPath.startsWith(`${root}${sep}`)) {
    return { ok: false, reason: 'invalid-path' };
  }
  try {
    assertNoSymlinkEscape(fullPath, resolve(deps.contentDir));
  } catch (err) {
    return { ok: false, reason: 'invalid-path', cause: err };
  }
  try {
    deps.assertContentPath?.(fullPath);
  } catch (err) {
    return { ok: false, reason: 'invalid-path', cause: err };
  }
  return { ok: true, fullPath };
}

function relativeToRoot(root: string, fullPath: string): string {
  return fullPath
    .slice(root.length + 1)
    .split(sep)
    .join('/');
}

export function createOfficeFileService(deps: OfficeFileServiceDeps): OfficeFileService {
  const maxBytes = deps.maxBytes ?? 100 * 1_048_576;

  async function resolveOfficeFile(requestedPath: string | null): Promise<OfficeResolveResult> {
    const confined = resolveConfinedPath(deps, requestedPath);
    if (!confined.ok) return confined;
    const normalized = (requestedPath as string).split('\\').join('/');
    const docType = officeDocTypeOf(normalized);
    if (docType === null) return { ok: false, reason: 'unsupported-type' };
    let bytes: Buffer;
    let mtimeMs: number;
    try {
      bytes = await readFile(confined.fullPath);
      mtimeMs = statSync(confined.fullPath).mtimeMs;
    } catch (err) {
      return { ok: false, reason: 'not-found', cause: err };
    }
    const root = resolve(deps.projectDir ?? deps.contentDir);
    return {
      ok: true,
      canonicalPath: confined.fullPath,
      relativePath: relativeToRoot(root, confined.fullPath),
      bytes,
      size: bytes.length,
      mtimeMs,
      etag: officeEtagForBytes(bytes, bytes.length, mtimeMs),
      contentType: officeContentTypeForPath(normalized),
      docType,
    };
  }

  async function writeOfficeFile(
    requestedPath: string | null,
    bytes: Buffer,
    ifMatch: string | null,
  ): Promise<OfficeWriteResult> {
    const confined = resolveConfinedPath(deps, requestedPath);
    if (!confined.ok) return confined;
    const normalized = (requestedPath as string).split('\\').join('/');
    if (!isOfficeDocFile(normalized)) return { ok: false, reason: 'unsupported-type' };
    if (bytes.length > maxBytes) return { ok: false, reason: 'payload-too-large' };
    let currentEtag: string | undefined;
    let existed = false;
    try {
      const st = statSync(confined.fullPath);
      if (!st.isFile()) return { ok: false, reason: 'not-found' };
      existed = true;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') return { ok: false, reason: 'write-failed', cause: err };
    }
    if (existed) {
      const current = await resolveOfficeFile(requestedPath);
      if (current.ok) {
        currentEtag = current.etag;
      } else if (current.reason !== 'not-found') {
        return { ok: false, reason: current.reason };
      } else {
        existed = false;
      }
    }
    if (ifMatch !== null && existed && currentEtag !== undefined && ifMatch !== currentEtag) {
      return { ok: false, reason: 'conflict', currentEtag };
    }
    const tmpPath = atomicTempPath(confined.fullPath);
    try {
      tracedMkdirSync(dirname(confined.fullPath), { recursive: true });
      writeFileSync(tmpPath, bytes);
      renameSync(tmpPath, confined.fullPath);
    } catch (err) {
      try {
        unlinkSync(tmpPath);
      } catch {}
      return { ok: false, reason: 'write-failed', cause: err };
    }
    let size = bytes.length;
    let mtimeMs = Date.now();
    try {
      const st = statSync(confined.fullPath);
      size = st.size;
      mtimeMs = st.mtimeMs;
    } catch (err) {
      return { ok: false, reason: 'write-failed', cause: err };
    }
    registerWrite(confined.fullPath, contentHash(bytes.toString('binary')));
    const root = resolve(deps.projectDir ?? deps.contentDir);
    const relativePath = relativeToRoot(root, confined.fullPath);
    try {
      deps.mutateFileIndex?.({
        kind: existed ? 'file-update' : 'file-create',
        path: confined.fullPath,
        relativePath,
        size,
        modifiedTs: mtimeMs,
        inode: 0,
      });
    } catch {}
    try {
      deps.signalFiles?.();
    } catch {}
    return {
      ok: true,
      canonicalPath: confined.fullPath,
      relativePath,
      etag: officeEtagForBytes(bytes, size, mtimeMs),
      size,
      mtimeMs,
      created: !existed,
    };
  }

  return { resolveOfficeFile, writeOfficeFile };
}
