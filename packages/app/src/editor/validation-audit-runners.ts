import {
  type ValidationAuditCountsResponse,
  ValidationAuditCountsResponseSchema,
  type ValidationAuditResponse,
  ValidationAuditResponseSchema,
} from '@inkeep/open-knowledge-core/markdown/lint';
import type { z } from 'zod';
import type { AuditScope } from './validation-audit-client.ts';
import { AUDIT_SUPERSEDED } from './validation-audit-client.ts';

export async function runValidationAudit(
  scope: AuditScope = { kind: 'project' },
  signal?: AbortSignal,
): Promise<ValidationAuditResponse | null | typeof AUDIT_SUPERSEDED> {
  return fetchAudit(scope, ValidationAuditResponseSchema, false, signal);
}

export async function runValidationAuditCounts(
  scope: AuditScope = { kind: 'project' },
  signal?: AbortSignal,
): Promise<ValidationAuditCountsResponse | null | typeof AUDIT_SUPERSEDED> {
  return fetchAudit(scope, ValidationAuditCountsResponseSchema, true, signal);
}

async function fetchAudit<T>(
  scope: AuditScope,
  schema: z.ZodType<T>,
  counts: boolean,
  signal?: AbortSignal,
): Promise<T | null | typeof AUDIT_SUPERSEDED> {
  try {
    const params = new URLSearchParams();
    if (scope.kind === 'path') params.set('path', scope.path);
    else if (scope.kind === 'doc') params.set('doc', scope.docName);
    if (counts) params.set('counts', '1');
    const query = params.size === 0 ? '' : `?${params}`;
    const res = await fetch(`/api/audit${query}`, signal === undefined ? undefined : { signal });
    if (!res.ok) {
      if (res.status === 409) return AUDIT_SUPERSEDED;
      console.warn('[audit] request failed', res.status, res.statusText);
      return null;
    }
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      if (signal?.aborted === true) return null;
      console.warn('[audit] response body is not valid JSON');
      return null;
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      console.warn('[audit] response failed schema validation', parsed.error.issues);
      return null;
    }
    return parsed.data;
  } catch (err) {
    if (signal?.aborted === true) return null;
    console.warn('[audit] fetch threw', err);
    return null;
  }
}
