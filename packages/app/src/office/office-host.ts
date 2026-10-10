import { useEffect, useRef, useState } from 'react';
import { subscribeToDocumentsChanged } from '@/lib/documents-events';

export type OfficeHostStatus =
  | 'idle'
  | 'loading'
  | 'clean'
  | 'dirty'
  | 'saving'
  | 'conflict'
  | 'externally-changed'
  | 'error';

export interface OfficeHostSnapshot {
  bytes: ArrayBuffer;
  etag: string;
  size: number;
  mtimeMs: number;
  contentType: string;
  docType: string;
}

export interface UseOfficeHostOptions {
  path: string | null;
  autoReloadOnExternalChange?: boolean | undefined;
}

export interface UseOfficeHost {
  status: OfficeHostStatus;
  snapshot: OfficeHostSnapshot | null;
  draft: ArrayBuffer | null;
  etag: string | null;
  serverEtag: string | null;
  error: string | null;
  conflictEtag: string | null;
  load: () => Promise<void>;
  setDraft: (bytes: ArrayBuffer) => void;
  save: () => Promise<boolean>;
  reload: () => Promise<void>;
  dismissExternalChange: () => void;
}

async function fetchSnapshot(path: string): Promise<OfficeHostSnapshot> {
  const res = await fetch(`/api/office/file?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error(`office load failed: ${res.status}`);
  const etag = res.headers.get('etag') ?? '';
  const bytes = await res.arrayBuffer();
  return {
    bytes,
    etag,
    size: bytes.byteLength,
    mtimeMs: 0,
    contentType: res.headers.get('content-type') ?? 'application/octet-stream',
    docType: res.headers.get('x-office-doc-type') ?? '',
  };
}

export function useOfficeHost(options: UseOfficeHostOptions): UseOfficeHost {
  const { path, autoReloadOnExternalChange = true } = options;
  const [status, setStatus] = useState<OfficeHostStatus>('idle');
  const [snapshot, setSnapshot] = useState<OfficeHostSnapshot | null>(null);
  const [draft, setDraftState] = useState<ArrayBuffer | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  const [serverEtag, setServerEtag] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflictEtag, setConflictEtag] = useState<string | null>(null);
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (path === null) return;
    setStatus('loading');
    setError(null);
    fetchSnapshot(path).then(
      (next) => {
        setSnapshot(next);
        setDraftState(null);
        setEtag(next.etag);
        setServerEtag(next.etag);
        setConflictEtag(null);
        dirtyRef.current = false;
        setStatus('clean');
      },
      (e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
        setStatus('error');
      },
    );
  }, [path]);

  useEffect(
    () =>
      subscribeToDocumentsChanged((channels) => {
        if (!channels.includes('files')) return;
        if (path === null) return;
        if (dirtyRef.current) {
          setStatus('externally-changed');
          return;
        }
        if (autoReloadOnExternalChange) {
          setStatus('loading');
          setError(null);
          fetchSnapshot(path).then(
            (next) => {
              setSnapshot(next);
              setDraftState(null);
              setEtag(next.etag);
              setServerEtag(next.etag);
              setConflictEtag(null);
              dirtyRef.current = false;
              setStatus('clean');
            },
            (e: unknown) => {
              setError(e instanceof Error ? e.message : String(e));
              setStatus('error');
            },
          );
        } else setStatus('externally-changed');
      }),
    [autoReloadOnExternalChange, path],
  );

  async function load() {
    if (path === null) return;
    setStatus('loading');
    setError(null);
    try {
      const next = await fetchSnapshot(path);
      setSnapshot(next);
      setDraftState(null);
      setEtag(next.etag);
      setServerEtag(next.etag);
      setConflictEtag(null);
      dirtyRef.current = false;
      setStatus('clean');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }

  function setDraft(bytes: ArrayBuffer) {
    dirtyRef.current = true;
    setDraftState(bytes.slice(0));
    setStatus('dirty');
  }

  async function save() {
    if (path === null || draft === null) return false;
    setStatus('saving');
    setError(null);
    try {
      const res = await fetch(`/api/office/file?path=${encodeURIComponent(path)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/octet-stream',
          ...(etag !== null ? { 'If-Match': etag } : {}),
        },
        body: draft,
      });
      if (res.status === 409) {
        const current = res.headers.get('etag');
        setConflictEtag(current);
        setServerEtag(current);
        setStatus('conflict');
        return false;
      }
      if (!res.ok) {
        setError(`office save failed: ${res.status}`);
        setStatus('error');
        return false;
      }
      const next = await fetchSnapshot(path);
      setSnapshot(next);
      setDraftState(null);
      setEtag(next.etag);
      setServerEtag(next.etag);
      setConflictEtag(null);
      dirtyRef.current = false;
      setStatus('clean');
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
      return false;
    }
  }

  async function reload() {
    await load();
  }
  function dismissExternalChange() {
    setConflictEtag(null);
    setStatus(dirtyRef.current ? 'dirty' : 'clean');
  }

  return {
    status,
    snapshot,
    draft,
    etag,
    serverEtag,
    error,
    conflictEtag,
    load,
    setDraft,
    save,
    reload,
    dismissExternalChange,
  };
}
