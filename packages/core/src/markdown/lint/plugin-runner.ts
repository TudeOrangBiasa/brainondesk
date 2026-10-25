import { resolveMarkdownlintConfig } from './default-config.ts';
import { validateFrontmatterSource } from './frontmatter-validate.ts';
import { fixMarkdownText, runMarkdownlint } from './markdownlint-runner.ts';
import {
  loadedOkfFrontmatterSchemas,
  OKF_FRONTMATTER_ONLY_TOGGLES,
  okfAdvertisedSchemaMappings,
  selectOkfFrontmatterSchemas,
} from './okf-frontmatter/registry.ts';
import { selectEnabledOkfRules } from './okf-rules.ts';
import { runOkfRules } from './okf-runner.ts';
import type { GoverningFrontmatterSchema } from './plugin-meta.ts';
import { selectApplicableFrontmatterSchemas } from './schema-select.ts';
import type {
  FrontmatterSchemaMapping,
  FrontmatterSlice,
  LintDiagnostic,
  LintPluginId,
  MarkdownlintSlice,
  OkfSlice,
} from './types.ts';

export interface LintPlugin<Id extends LintPluginId, Slice extends { enabled: boolean }> {
  id: Id;
  lint(text: string, slice: Slice, ctx: { docName?: string }): Promise<LintDiagnostic[]>;
  fix?(text: string, slice: Slice): string;
  frontmatter?: {
    schemasForDoc(slice: Slice, docName: string): readonly GoverningFrontmatterSchema[];
    narrowSliceToFrontmatter(slice: Slice): Slice;
    advertisedMappings(slice: Slice): readonly FrontmatterSchemaMapping[];
  };
}

const markdownlintPlugin: LintPlugin<'markdownlint', MarkdownlintSlice> = {
  id: 'markdownlint',
  lint: (text, slice) =>
    Promise.resolve(runMarkdownlint(text, resolveMarkdownlintConfig(slice.rules))),
  fix(text, slice) {
    return fixMarkdownText(text, resolveMarkdownlintConfig(slice.rules));
  },
};

const frontmatterPlugin: LintPlugin<'frontmatter', FrontmatterSlice> = {
  id: 'frontmatter',
  async lint(text, slice, ctx) {
    return validateFrontmatterSource(
      text,
      selectApplicableFrontmatterSchemas(slice.schemas, ctx.docName),
    );
  },
  frontmatter: {
    schemasForDoc: (slice, docName) => selectApplicableFrontmatterSchemas(slice.schemas, docName),
    narrowSliceToFrontmatter: (slice) => slice,
    advertisedMappings: (slice) => slice.schemas,
  },
};

const okfPlugin: LintPlugin<'okf', OkfSlice> = {
  id: 'okf',
  async lint(text, slice, ctx) {
    const loaded = loadedOkfFrontmatterSchemas(slice.rules, ctx.docName);
    return [
      ...runOkfRules(text, selectEnabledOkfRules(slice.rules), ctx.docName),
      ...(loaded.length === 0 ? [] : validateFrontmatterSource(text, loaded, { source: 'okf' })),
    ];
  },
  frontmatter: {
    schemasForDoc: (slice, docName) => selectOkfFrontmatterSchemas(slice.rules, docName),
    narrowSliceToFrontmatter: (slice) => ({
      ...slice,
      rules: { ...slice.rules, ...OKF_FRONTMATTER_ONLY_TOGGLES },
    }),
    advertisedMappings: (slice) => okfAdvertisedSchemaMappings(slice.rules),
  },
};

export const LINT_RUNNER_PLUGINS = [markdownlintPlugin, frontmatterPlugin, okfPlugin] as const;

export type LintRunnerPluginEntry = (typeof LINT_RUNNER_PLUGINS)[number];
