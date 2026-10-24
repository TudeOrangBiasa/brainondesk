import { compileAppliesTo } from './applies-to.ts';
import type { ResolvedFrontmatterSchemaEntry } from './types.ts';

export interface LoadedFrontmatterSchema {
  file: string;
  schema: Record<string, unknown>;
  ruleId?: string;
}

export function selectApplicableFrontmatterSchemas(
  entries: readonly ResolvedFrontmatterSchemaEntry[],
  docName: string | undefined,
): LoadedFrontmatterSchema[] {
  const seen = new Set<string>();
  const selected: LoadedFrontmatterSchema[] = [];
  for (const entry of entries) {
    if (entry.enabled === false) continue;
    if (!entry.schema) continue;
    if (!compileAppliesTo(entry.appliesTo).matches(docName)) continue;
    const key = entry.key ?? entry.file;
    if (seen.has(key)) continue;
    seen.add(key);
    selected.push({ file: entry.file, schema: entry.schema });
  }
  return selected;
}
