export {
  type AppliesToPatternSummary,
  type AppliesToSummary,
  type CompiledAppliesTo,
  compileAppliesTo,
  findZeroMatchAppliesToPatterns,
  summarizeAppliesTo,
} from './applies-to.ts';
export { isMarkdownlintJsonConfig } from './config-files.ts';
export {
  type FrontmatterSchemasListSuccess,
  FrontmatterSchemasListSuccessSchema,
  type FrontmatterSchemaWriteRequest,
  FrontmatterSchemaWriteRequestSchema,
  isReLintFailedWarning,
  isReLintFailureReason,
  type LintAuditResponse,
  LintAuditResponseSchema,
  type LintConfigResponse,
  LintConfigResponseSchema,
  type LintDocResult,
  LintDocResultSchema,
  LinterConfigSchema,
  type LintFixRequest,
  LintFixRequestSchema,
  type LintFixResult,
  LintFixResultSchema,
  MarkdownlintRuleWriteRequestSchema,
  type PersistedLinterConfig,
  RE_LINT_FAILED_WARNING_PREFIX,
  RE_LINT_FAILURE_REASONS,
  type ReLintFailure,
  type ReLintFailureReason,
  ReLintFailureSchema,
  toEffectiveBase,
  type ValidationAuditCountsResponse,
  ValidationAuditCountsResponseSchema,
  type ValidationAuditResponse,
  ValidationAuditResponseSchema,
  type ValidationDocCounts,
  ValidationDocCountsSchema,
  type ValidationDocResult,
  ValidationDocResultSchema,
} from './config-schemas.ts';
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
  frontmatterSchemaCompileError,
  type LoadedFrontmatterSchema,
} from './frontmatter-validate.ts';
export { fixMarkdownText, runMarkdownlint } from './markdownlint-runner.ts';
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
export { runOkfFrontmatterRules } from './okf-frontmatter/runner.ts';
export {
  OKF_PROJECT_REGISTRY,
  type OkfProjectFinding,
  runOkfProjectRules,
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
  LINT_PLUGINS,
  type LinterConfig,
  type LintPluginId,
  selectAdvertisedFrontmatterMappings,
  selectFrontmatterOnlyConfig,
  selectGoverningFrontmatterSchemas,
} from './plugin-meta.ts';
export { LINT_SLICE_SCHEMAS, type LintPlugin } from './plugins.ts';
export { canonicalRuleId, findRuleConfigEntry } from './rule-aliases.ts';
export { MARKDOWNLINT_RULE_CATALOG } from './rule-catalog.generated.ts';
export {
  displayCategoryForRule,
  RULE_DISPLAY_CATEGORIES,
  type RuleDisplayCategory,
} from './rule-catalog-categories.ts';
export { fixDocument, lintDocument } from './runner.ts';
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
