import { DEFAULT_MARKDOWNLINT_CONFIG } from './default-config.ts';
import type { OkfRuleId } from './okf-rule-meta.ts';
import type { LinterConfig } from './plugin-meta.ts';
import type { FrontmatterSchemaMapping, MarkdownlintRuleSetting } from './types.ts';

export interface PersistedMarkdownlintSlice {
  enabled: boolean;
  rules?: Record<string, MarkdownlintRuleSetting>;
}
export interface PersistedFrontmatterSlice {
  enabled: boolean;
  schemas?: FrontmatterSchemaMapping[];
}
export interface PersistedOkfSlice {
  enabled: boolean;
  rules?: Partial<Record<OkfRuleId, boolean>>;
  generate?: { index?: boolean };
}
export interface PersistedLinterConfig {
  enabled?: boolean;
  markdownlint: PersistedMarkdownlintSlice;
  frontmatter?: PersistedFrontmatterSlice;
  okf?: PersistedOkfSlice;
}

export function toEffectiveBase(persisted: PersistedLinterConfig): LinterConfig {
  return {
    enabled: persisted.enabled ?? true,
    plugins: {
      markdownlint: {
        ...persisted.markdownlint,
        rules: persisted.markdownlint.rules ?? DEFAULT_MARKDOWNLINT_CONFIG,
      },
      frontmatter: {
        enabled: persisted.frontmatter?.enabled ?? false,
        schemas: persisted.frontmatter?.schemas ?? [],
      },
      okf: {
        enabled: persisted.okf?.enabled ?? false,
        ...(persisted.okf?.rules === undefined ? {} : { rules: persisted.okf.rules }),
        generate: { index: persisted.okf?.generate?.index ?? false },
      },
    },
  };
}

export type { LinterConfig };
