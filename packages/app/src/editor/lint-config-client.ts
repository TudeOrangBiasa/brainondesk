import {
  type FrontmatterFieldConstraint,
  type LintConfigResponse,
  LintConfigResponseSchema,
  type LintFixResult,
  LintFixResultSchema,
  type MarkdownlintRuleWriteValue,
  type SchemaParentPathSegment,
} from '@inkeep/open-knowledge-core/markdown/lint';
import { emitLintConfigChanged } from './lint-config-events.ts';

export { emitLintConfigChanged };

export const LINT_FIX_TIMEOUT_MS = 30_000;

export async function fixLintDoc(
  docName: string,
): Promise<
  | { ok: true; result: LintFixResult }
  | { ok: false; errorDetail: string | null; status: number | null; problemType: string | null }
> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LINT_FIX_TIMEOUT_MS);
  try {
    const res = await fetch('/api/lint/fix', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ docName }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const errBody = (await res.json().catch(() => null)) as {
        title?: unknown;
        type?: unknown;
      } | null;
      return {
        ok: false,
        errorDetail: typeof errBody?.title === 'string' ? errBody.title : null,
        status: res.status,
        problemType: typeof errBody?.type === 'string' ? errBody.type : null,
      };
    }
    const body = await res.json().catch(() => null);
    const parsed = LintFixResultSchema.safeParse(body);
    if (!parsed.success) {
      console.warn('[lint] fix response failed schema validation', parsed.error.issues);
      return { ok: false, errorDetail: null, status: res.status, problemType: null };
    }
    return { ok: true, result: parsed.data };
  } catch (err) {
    console.warn('[lint] fix request failed', docName, err instanceof Error ? err.message : err);
    return { ok: false, errorDetail: null, status: null, problemType: null };
  } finally {
    clearTimeout(timeout);
  }
}

export async function writeMarkdownlintRule(
  ruleId: string,
  value: MarkdownlintRuleWriteValue | null,
): Promise<{ ok: true; response: LintConfigResponse } | { ok: false; errorDetail: string | null }> {
  try {
    const res = await fetch('/api/lint/markdownlint-config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ruleId, value }),
    });
    if (!res.ok) {
      const errBody = (await res.json().catch(() => null)) as { title?: unknown } | null;
      return {
        ok: false,
        errorDetail: typeof errBody?.title === 'string' ? errBody.title : null,
      };
    }
    const body = await res.json().catch(() => null);
    const parsed = LintConfigResponseSchema.safeParse(body);
    return parsed.success ? { ok: true, response: parsed.data } : { ok: false, errorDetail: null };
  } catch {
    return { ok: false, errorDetail: null };
  }
}

async function postFrontmatterSchema(body: {
  file: string;
  delete?: true;
  field?: string;
  constraint?: FrontmatterFieldConstraint;
  removeField?: true;
  renameTo?: string;
  parentPath?: readonly SchemaParentPathSegment[];
}): Promise<
  { ok: true; response: LintConfigResponse } | { ok: false; errorDetail: string | null }
> {
  try {
    const res = await fetch('/api/lint/frontmatter-schema', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errBody = (await res.json().catch(() => null)) as { title?: unknown } | null;
      return {
        ok: false,
        errorDetail: typeof errBody?.title === 'string' ? errBody.title : null,
      };
    }
    const parsed = LintConfigResponseSchema.safeParse(await res.json().catch(() => null));
    return parsed.success ? { ok: true, response: parsed.data } : { ok: false, errorDetail: null };
  } catch {
    return { ok: false, errorDetail: null };
  }
}

function wireParentPath(
  parentPath: readonly SchemaParentPathSegment[],
): readonly SchemaParentPathSegment[] | undefined {
  return parentPath.length > 0 ? parentPath : undefined;
}

export async function writeFrontmatterSchemaField(
  file: string,
  field: string,
  constraint: FrontmatterFieldConstraint,
  parentPath: readonly SchemaParentPathSegment[] = [],
): Promise<{ ok: true; response: LintConfigResponse } | { ok: false; errorDetail: string | null }> {
  return postFrontmatterSchema({ file, field, constraint, parentPath: wireParentPath(parentPath) });
}

export async function createEmptyFrontmatterSchema(
  file: string,
): Promise<{ ok: true } | { ok: false; errorDetail: string | null }> {
  const result = await postFrontmatterSchema({ file });
  if (result.ok) emitLintConfigChanged();
  return result;
}

export async function removeFrontmatterSchemaField(
  file: string,
  field: string,
  parentPath: readonly SchemaParentPathSegment[] = [],
): Promise<{ ok: true } | { ok: false; errorDetail: string | null }> {
  return postFrontmatterSchema({
    file,
    field,
    removeField: true,
    parentPath: wireParentPath(parentPath),
  });
}

export async function renameFrontmatterSchemaField(
  file: string,
  field: string,
  renameTo: string,
  parentPath: readonly SchemaParentPathSegment[] = [],
): Promise<{ ok: true } | { ok: false; errorDetail: string | null }> {
  return postFrontmatterSchema({ file, field, renameTo, parentPath: wireParentPath(parentPath) });
}

export async function deleteFrontmatterSchema(
  file: string,
): Promise<{ ok: true } | { ok: false; errorDetail: string | null }> {
  const result = await postFrontmatterSchema({ file, delete: true });
  if (result.ok) emitLintConfigChanged();
  return result;
}
