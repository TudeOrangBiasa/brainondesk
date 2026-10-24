export type FrontmatterSchemaDialect = 'draft-06' | 'draft-07' | '2019-09' | '2020-12';

export const CANONICAL_SCHEMA_DIALECT_URIS: Record<FrontmatterSchemaDialect, string> = {
  'draft-06': 'http://json-schema.org/draft-06/schema#',
  'draft-07': 'http://json-schema.org/draft-07/schema#',
  '2019-09': 'https://json-schema.org/draft/2019-09/schema',
  '2020-12': 'https://json-schema.org/draft/2020-12/schema',
};

export const SUPPORTED_SCHEMA_DIALECTS = Object.keys(
  CANONICAL_SCHEMA_DIALECT_URIS,
) as readonly FrontmatterSchemaDialect[];

export const DEFAULT_SCHEMA_DIALECT: FrontmatterSchemaDialect = 'draft-07';

const DIALECT_BY_NORMALIZED_URI = new Map<string, FrontmatterSchemaDialect>(
  SUPPORTED_SCHEMA_DIALECTS.map((dialect) => [
    normalizeDialectUri(CANONICAL_SCHEMA_DIALECT_URIS[dialect]),
    dialect,
  ]),
);

function normalizeDialectUri(uri: string): string {
  return uri.replace(/^https?:\/\//, '').replace(/#$/, '');
}

export function resolveFrontmatterSchemaDialect(
  schema: Record<string, unknown>,
): FrontmatterSchemaDialect | null {
  const declared = schema.$schema;
  if (declared === undefined) return DEFAULT_SCHEMA_DIALECT;
  if (typeof declared !== 'string') return null;
  return DIALECT_BY_NORMALIZED_URI.get(normalizeDialectUri(declared)) ?? null;
}

export function isSupportedSchemaDialect(schema: Record<string, unknown>): boolean {
  return resolveFrontmatterSchemaDialect(schema) !== null;
}
