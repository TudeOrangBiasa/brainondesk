import type {
  ValidationAuditCountsResponse,
  ValidationAuditResponse,
  ValidationDocResult,
} from '@inkeep/open-knowledge-core/markdown/lint/light';
import type { BrokenLinkSuppression } from '@inkeep/open-knowledge-core/schemas/api';
import { useEffect, useState } from 'react';
import { invalidatesLocalTargetAudit, subscribeToDocumentsChanged } from '@/lib/documents-events';
import { subscribeToLintConfigChanged } from './lint-config-events';

type WireDiagnostic = ValidationDocResult['diagnostics'][number];

export type AuditScope =
  | { kind: 'project' }
  | { kind: 'path'; path: string }
  | { kind: 'doc'; docName: string };

export const AUDIT_SUPERSEDED = 'audit-superseded' as const;

export async function runValidationAudit(
  scope: AuditScope = { kind: 'project' },
  signal?: AbortSignal,
): Promise<ValidationAuditResponse | null | typeof AUDIT_SUPERSEDED> {
  const { runValidationAudit: run } = await import('./validation-audit-runners.ts');
  return run(scope, signal);
}

export async function runValidationAuditCounts(
  scope: AuditScope = { kind: 'project' },
  signal?: AbortSignal,
): Promise<ValidationAuditCountsResponse | null | typeof AUDIT_SUPERSEDED> {
  const { runValidationAuditCounts: run } = await import('./validation-audit-runners.ts');
  return run(scope, signal);
}

interface DocLinkFindingsSnapshot {
  findings: readonly WireDiagnostic[];
  brokenLinkSuppression?: BrokenLinkSuppression;
}

export type DocLinkFindingsState = DocLinkFindingsSnapshot & {
  status: 'idle' | 'loading' | 'loaded' | 'failed';
};

export function subscribeToDocLinkFindings(
  docName: string,
  onState: (state: DocLinkFindingsState) => void,
): () => void {
  let disposed = false;
  let inFlight = false;
  let dirty = false;
  let findings: readonly WireDiagnostic[] = [];
  let brokenLinkSuppression: BrokenLinkSuppression | undefined;
  let controller: AbortController | null = null;

  const snapshot = (): DocLinkFindingsSnapshot => ({
    findings,
    ...(brokenLinkSuppression === undefined ? {} : { brokenLinkSuppression }),
  });

  const load = (): void => {
    if (inFlight) {
      dirty = true;
      return;
    }
    inFlight = true;
    controller = new AbortController();
    onState({ status: 'loading', ...snapshot() });
    void runValidationAudit({ kind: 'doc', docName }, controller.signal)
      .then((result) => {
        if (disposed || controller?.signal.aborted === true) return;
        if (result === null) {
          onState({ status: 'failed', ...snapshot() });
          return;
        }
        if (result === AUDIT_SUPERSEDED) {
          dirty = true;
          return;
        }
        if (dirty) return;
        findings = result.files
          .flatMap((file) => file.diagnostics)
          .filter((diagnostic) => diagnostic.source === 'links');
        brokenLinkSuppression = result.brokenLinkSuppression;
        onState({ status: 'loaded', ...snapshot() });
      })
      .finally(() => {
        if (disposed) return;
        inFlight = false;
        controller = null;
        if (dirty) {
          dirty = false;
          load();
        }
      });
  };

  load();
  const unsubscribeDocuments = subscribeToDocumentsChanged((channels) => {
    if (channels.includes('backlinks') || invalidatesLocalTargetAudit(channels)) load();
  });
  const unsubscribeLintConfig = subscribeToLintConfigChanged(load);
  return () => {
    disposed = true;
    controller?.abort();
    unsubscribeDocuments();
    unsubscribeLintConfig();
  };
}

export function useDocLinkFindings(docName: string | null): DocLinkFindingsState {
  const [owned, setOwned] = useState<{
    docName: string | null;
    state: DocLinkFindingsState;
  }>({ docName: null, state: { status: 'idle', findings: [] } });
  useEffect(() => {
    if (docName === null) {
      setOwned({ docName: null, state: { status: 'idle', findings: [] } });
      return;
    }
    setOwned({ docName, state: { status: 'loading', findings: [] } });
    return subscribeToDocLinkFindings(docName, (state) => setOwned({ docName, state }));
  }, [docName]);
  if (owned.docName !== docName) {
    return docName === null
      ? { status: 'idle', findings: [] }
      : { status: 'loading', findings: [] };
  }
  return owned.state;
}
