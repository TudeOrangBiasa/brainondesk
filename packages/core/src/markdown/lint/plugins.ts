import { z } from 'zod';
import {
  DEFAULT_LINTER_CONFIG,
  type GoverningFrontmatterSchema,
  isLintPluginSelected,
  LINT_PLUGINS,
  type LinterConfig,
  selectAdvertisedFrontmatterMappings,
  selectFrontmatterOnlyConfig,
  selectGoverningFrontmatterSchemas,
} from './plugin-meta.ts';
import type { LintPlugin } from './plugin-runner.ts';
import {
  type FrontmatterSlice,
  type LintPluginId,
  MARKDOWNLINT_RULE_SEVERITIES,
  type MarkdownlintSlice,
  type OkfSlice,
} from './types.ts';

export type { FrontmatterSlice, LintPlugin, LintPluginId, MarkdownlintSlice, OkfSlice };
export {
  DEFAULT_LINTER_CONFIG,
  type GoverningFrontmatterSchema,
  isLintPluginSelected,
  LINT_PLUGINS,
  type LinterConfig,
  selectAdvertisedFrontmatterMappings,
  selectFrontmatterOnlyConfig,
  selectGoverningFrontmatterSchemas,
};

const MarkdownlintRuleSettingSchema = z.union([
  z.boolean(),
  z.enum(MARKDOWNLINT_RULE_SEVERITIES),
  z.record(z.string(), z.unknown()),
]);

const FrontmatterSchemaEntrySchema = z.object({
  appliesTo: z.union([z.string(), z.array(z.string())]).optional(),
  file: z.string(),
  enabled: z.boolean().optional(),
  key: z.string().optional(),
  schema: z.record(z.string(), z.unknown()).optional(),
});

export const LINT_SLICE_SCHEMAS = {
  markdownlint: z.object({
    enabled: z.boolean(),
    rules: z.record(z.string(), MarkdownlintRuleSettingSchema),
  }),
  frontmatter: z.object({
    enabled: z.boolean(),
    schemas: z.array(FrontmatterSchemaEntrySchema),
  }),
  okf: z.object({
    enabled: z.boolean(),
    rules: z.record(z.string(), z.boolean()).optional(),
    generate: z.object({ index: z.boolean().optional() }).optional(),
  }),
} as const;
