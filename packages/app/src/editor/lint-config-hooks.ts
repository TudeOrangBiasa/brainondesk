import type {
  LintConfigResponse,
  LinterConfig,
} from '@inkeep/open-knowledge-core/markdown/lint/light';
import { useEffect, useState } from 'react';
import { emitLintConfigChanged, subscribeToLintConfigChanged } from './lint-config-events.ts';

export { emitLintConfigChanged, subscribeToLintConfigChanged };

async function fetchLintConfig(docName?: string): Promise<LintConfigResponse | null> {
  try {
    const query = docName !== undefined ? `?doc=${encodeURIComponent(docName)}` : '';
    const res = await fetch(`/api/lint/config${query}`);
    if (!res.ok) return null;
    const body = await res.json().catch(() => null);
    if (body === null || typeof body !== 'object' || Array.isArray(body)) return null;
    if (!('effective' in body)) return null;
    return body as LintConfigResponse;
  } catch {
    return null;
  }
}

export async function fetchEffectiveLintConfig(docName: string): Promise<LinterConfig | null> {
  const response = await fetchLintConfig(docName);
  return response?.effective ?? null;
}

async function listFrontmatterSchemas(): Promise<string[]> {
  try {
    const res = await fetch('/api/lint/frontmatter-schemas');
    if (!res.ok) return [];
    const body = await res.json().catch(() => null);
    if (body === null || typeof body !== 'object' || Array.isArray(body)) return [];
    if (!('schemas' in body) || !Array.isArray(body.schemas)) return [];
    return body.schemas.filter((s: unknown): s is string => typeof s === 'string');
  } catch {
    return [];
  }
}

export function useFrontmatterSchemaFiles(): { schemas: string[]; refresh: () => void } {
  const [schemas, setSchemas] = useState<string[]>([]);
  const refresh = () => {
    void listFrontmatterSchemas().then(setSchemas);
  };
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void listFrontmatterSchemas().then((next) => {
        if (!cancelled) setSchemas(next);
      });
    };
    load();
    const unsub = subscribeToLintConfigChanged(load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);
  return { schemas, refresh };
}

export function useDocLintConfig(docName: string | null): {
  data: LintConfigResponse | null;
} {
  const [data, setData] = useState<LintConfigResponse | null>(null);
  useEffect(() => {
    if (!docName) {
      setData(null);
      return;
    }
    let cancelled = false;
    const load = () => {
      void fetchLintConfig(docName).then((next) => {
        if (!cancelled) setData(next);
      });
    };
    load();
    const unsub = subscribeToLintConfigChanged(load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [docName]);
  return { data };
}

export function useProjectLintConfig(): { data: LintConfigResponse | null } {
  const [data, setData] = useState<LintConfigResponse | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      void fetchLintConfig().then((next) => {
        if (!cancelled) setData(next);
      });
    };
    load();
    const unsub = subscribeToLintConfigChanged(load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);
  return { data };
}
