import { DEFAULT_MARKDOWNLINT_CONFIG } from './default-config.ts';
import {
  OKF_FRONTMATTER_ONLY_TOGGLES,
  okfAdvertisedSchemaMappings,
  selectOkfFrontmatterSchemas,
} from './okf-frontmatter/registry.ts';
import type { OkfRuleToggles } from './okf-rule-meta.ts';
import { selectApplicableFrontmatterSchemas } from './schema-select.ts';
import type {
  FrontmatterSchemaMapping,
  FrontmatterSlice,
  LintPluginId,
  MarkdownlintSlice,
  OkfSlice,
  ResolvedFrontmatterSchemaEntry,
} from './types.ts';

export interface GoverningFrontmatterSchema {
  schema: Record<string, unknown>;
}

export interface LightLintPlugin<Id extends LintPluginId, Slice extends { enabled: boolean }> {
  id: Id;
  defaultSlice: Slice;
  frontmatter?:
    | {
        schemasForDoc(slice: Slice, docName: string): readonly GoverningFrontmatterSchema[];
        narrowSliceToFrontmatter(slice: Slice): Slice;
        advertisedMappings(slice: Slice): readonly FrontmatterSchemaMapping[];
      }
    | undefined;
}

const markdownlintLight: LightLintPlugin<'markdownlint', MarkdownlintSlice> = {
  id: 'markdownlint',
  defaultSlice: { enabled: false, rules: DEFAULT_MARKDOWNLINT_CONFIG },
  frontmatter: undefined,
};

const frontmatterLight: LightLintPlugin<'frontmatter', FrontmatterSlice> = {
  id: 'frontmatter',
  defaultSlice: { enabled: false, schemas: [] },
  frontmatter: {
    schemasForDoc: (slice, docName) => selectApplicableFrontmatterSchemas(slice.schemas, docName),
    narrowSliceToFrontmatter: (slice) => slice,
    advertisedMappings: (slice) =>
      slice.schemas.map((entry: ResolvedFrontmatterSchemaEntry): FrontmatterSchemaMapping => {
        const mapping: FrontmatterSchemaMapping = { file: entry.file };
        if (entry.appliesTo !== undefined) mapping.appliesTo = entry.appliesTo;
        if (entry.enabled !== undefined) mapping.enabled = entry.enabled;
        return mapping;
      }),
  },
};

const okfLight: LightLintPlugin<'okf', OkfSlice> = {
  id: 'okf',
  defaultSlice: { enabled: false },
  frontmatter: {
    schemasForDoc: (slice, docName) => selectOkfFrontmatterSchemas(slice.rules, docName),
    narrowSliceToFrontmatter: (slice) => ({
      ...slice,
      rules: { ...slice.rules, ...OKF_FRONTMATTER_ONLY_TOGGLES },
    }),
    advertisedMappings: (slice) => okfAdvertisedSchemaMappings(slice.rules),
  },
};

export const LINT_PLUGINS = [markdownlintLight, frontmatterLight, okfLight] as const;

type LintPluginEntry = (typeof LINT_PLUGINS)[number];

export type LinterConfig = {
  enabled: boolean;
  plugins: {
    [K in LintPluginId]: Extract<LintPluginEntry, { id: K }> extends LightLintPlugin<K, infer S>
      ? S
      : never;
  };
};

export const DEFAULT_LINTER_CONFIG: LinterConfig = {
  enabled: true,
  plugins: Object.fromEntries(
    LINT_PLUGINS.map((plugin) => [plugin.id, plugin.defaultSlice]),
  ) as LinterConfig['plugins'],
};

export function isLintPluginSelected(config: LinterConfig, id: LintPluginId): boolean {
  return config.enabled && config.plugins[id]?.enabled === true;
}

function frontmatterPluginEntries(config: LinterConfig | null): {
  plugin: LintPluginEntry;
  slice: { enabled: boolean };
}[] {
  if (!config?.enabled) return [];
  const entries: { plugin: LintPluginEntry; slice: { enabled: boolean } }[] = [];
  for (const plugin of LINT_PLUGINS) {
    if (plugin.frontmatter === undefined) continue;
    const slice = config.plugins[plugin.id];
    if (slice?.enabled !== true) continue;
    entries.push({ plugin, slice });
  }
  return entries;
}

export function selectGoverningFrontmatterSchemas(
  config: LinterConfig | null,
  docName: string | undefined,
): GoverningFrontmatterSchema[] {
  if (docName === undefined || docName === '') return [];
  const governing: GoverningFrontmatterSchema[] = [];
  for (const { plugin, slice } of frontmatterPluginEntries(config)) {
    governing.push(...(plugin.frontmatter?.schemasForDoc(slice as never, docName) ?? []));
  }
  return governing;
}

export function selectAdvertisedFrontmatterMappings(
  config: LinterConfig | null,
): FrontmatterSchemaMapping[] {
  const advertised: FrontmatterSchemaMapping[] = [];
  for (const { plugin, slice } of frontmatterPluginEntries(config)) {
    advertised.push(...(plugin.frontmatter?.advertisedMappings(slice as never) ?? []));
  }
  return advertised;
}

export function selectFrontmatterOnlyConfig(config: LinterConfig): LinterConfig {
  const plugins = Object.fromEntries(
    LINT_PLUGINS.map((plugin) => {
      const slice = config.plugins[plugin.id] ?? plugin.defaultSlice;
      if (plugin.frontmatter === undefined) return [plugin.id, { ...slice, enabled: false }];
      return [plugin.id, plugin.frontmatter.narrowSliceToFrontmatter(slice as never)];
    }),
  ) as LinterConfig['plugins'];
  return { ...config, plugins };
}

export type { LintPluginId, OkfRuleToggles };
