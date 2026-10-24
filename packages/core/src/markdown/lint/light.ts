export {
  type AppliesToPatternSummary,
  type AppliesToSummary,
  type CompiledAppliesTo,
  compileAppliesTo,
  findZeroMatchAppliesToPatterns,
  summarizeAppliesTo,
} from './applies-to.ts';
export {
  type PersistedFrontmatterSlice,
  type PersistedLinterConfig,
  type PersistedMarkdownlintSlice,
  type PersistedOkfSlice,
  toEffectiveBase,
} from './config-base.ts';
export { isMarkdownlintJsonConfig } from './config-files.ts';
export { DEFAULT_MARKDOWNLINT_CONFIG, resolveMarkdownlintConfig } from './default-config.ts';
export {
  CANONICAL_SCHEMA_DIALECT_URIS,
  DEFAULT_SCHEMA_DIALECT,
  type FrontmatterSchemaDialect,
  isSupportedSchemaDialect,
  resolveFrontmatterSchemaDialect,
  SUPPORTED_SCHEMA_DIALECTS,
} from './frontmatter-dialects.ts';
export {
  applyFieldConstraint,
  emptyFrontmatterSchemaText,
  type FrontmatterFieldConstraint,
  FrontmatterSchemaEditError,
  isFrontmatterSchemaAsset,
  isToolManagedSchemaPath,
  removeSchemaField,
  renameSchemaField,
  type SchemaParentPathSegment,
} from './frontmatter-schema-edit.ts';
export {
  OKF_SCHEMA_DIR,
  type OkfSchemaFile,
  okfSchemaPathFor,
  renderOkfSchemaFiles,
} from './okf-frontmatter/materialize.ts';
export {
  loadedOkfFrontmatterSchemas,
  OKF_FRONTMATTER_REGISTRY,
  okfAdvertisedSchemaMappings,
  selectOkfFrontmatterSchemas,
} from './okf-frontmatter/registry.ts';
export {
  OKF_PROJECT_REGISTRY,
  type OkfProjectFinding,
} from './okf-project/rules.ts';
export {
  assertNeverOkfRuleGroupId,
  assertNeverOkfRuleId,
  isOkfRuleEnabled,
  OKF_RULE_GROUPS,
  OKF_RULE_IDS,
  type OkfRuleGroupId,
  type OkfRuleId,
  type OkfRuleToggles,
} from './okf-rule-meta.ts';
export {
  type LintPluginFailure,
  type LintPluginFailureReporter,
  summarizeLintPluginFailures,
} from './plugin-failure.ts';
export {
  DEFAULT_LINTER_CONFIG,
  type GoverningFrontmatterSchema,
  isLintPluginSelected,
  LINT_PLUGINS,
  type LightLintPlugin,
  type LinterConfig,
  type LintPluginId,
  selectAdvertisedFrontmatterMappings,
  selectFrontmatterOnlyConfig,
  selectGoverningFrontmatterSchemas,
} from './plugin-meta.ts';
export { canonicalRuleId, findRuleConfigEntry } from './rule-aliases.ts';
export { MARKDOWNLINT_RULE_CATALOG } from './rule-catalog.generated.ts';
export {
  displayCategoryForRule,
  RULE_DISPLAY_CATEGORIES,
  type RuleDisplayCategory,
} from './rule-catalog-categories.ts';
export type { LoadedFrontmatterSchema } from './schema-select.ts';
export { selectApplicableFrontmatterSchemas } from './schema-select.ts';
export { applyTextEdits } from './text-edits.ts';
export type {
  FrontmatterSchemaMapping,
  FrontmatterScope,
  FrontmatterSlice,
  LinksValidationSetting,
  LintDiagnostic,
  LintPosition,
  LintRange,
  LintSeverity,
  LintTextEdit,
  LocalTargetDiagnosticEvidence,
  LocalTargetKind,
  LocalTargetResolutionMethod,
  LocalTargetRole,
  LocalTargetSourceForm,
  MarkdownlintRuleSetting,
  MarkdownlintRuleSeverity,
  MarkdownlintRuleWriteValue,
  MarkdownlintSlice,
  OkfSlice,
  ResolvedFrontmatterSchemaEntry,
  RuleCatalogEntry,
  RuleOptionSpec,
  RuleOptionType,
  ValidationDiagnostic,
  ValidationSource,
} from './types.ts';
export {
  DEFAULT_LINKS_VALIDATION,
  DEFAULT_SUPPRESS_LOG_LINK_ADVISORIES,
  isFrontmatterScoped,
  LINKS_VALIDATION_SETTINGS,
  LINT_PLUGIN_IDS,
  VALIDATION_SOURCES,
} from './types.ts';
export {
  countDiagnosticsBySource,
  type ValidationCountsBySource,
  type ValidationSourceCounts,
  type ValidationSourceKey,
  ZERO_SOURCE_COUNTS,
} from './validation-counts.ts';
export {
  AUDIT_EMPTY_SCOPE_WARNING,
  deriveValidationRunSources,
  isAuditEmptyScopeWarning,
  type ValidationRunMode,
  validationCoverageLines,
} from './validation-run-sources.ts';
export type {
  LintConfigResponse,
  ValidationAuditCountsResponse,
  ValidationAuditResponse,
  ValidationDocCounts,
  ValidationDocResult,
} from './wire-types.ts';
