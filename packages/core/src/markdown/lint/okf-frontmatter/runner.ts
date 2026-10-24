import { validateFrontmatterSource } from '../frontmatter-validate.ts';
import type { OkfRuleToggles } from '../okf-rule-meta.ts';
import type { LintDiagnostic } from '../types.ts';
import { loadedOkfFrontmatterSchemas } from './registry.ts';

export function runOkfFrontmatterRules(
  text: string,
  rules: OkfRuleToggles,
  docName: string | undefined,
): LintDiagnostic[] {
  const selected = loadedOkfFrontmatterSchemas(rules, docName);
  if (selected.length === 0) return [];
  return validateFrontmatterSource(text, selected, { source: 'okf' });
}
