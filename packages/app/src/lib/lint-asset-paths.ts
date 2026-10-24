const MARKDOWNLINT_JSON_CONFIG_FILES: ReadonlySet<string> = new Set([
  '.markdownlint.json',
  '.markdownlint.jsonc',
]);

export function isMarkdownlintJsonConfig(basename: string): boolean {
  return MARKDOWNLINT_JSON_CONFIG_FILES.has(basename);
}

export function isToolManagedSchemaPath(file: string): boolean {
  const normalized = file.trim().replace(/^\.\//, '');
  if (!normalized.startsWith('.ok/schemas/')) return false;
  const name = normalized.slice('.ok/schemas/'.length);
  return (
    name.length > 0 && !name.includes('/') && !name.includes('\\') && name !== '.' && name !== '..'
  );
}
export function isFrontmatterSchemaAsset(path: string): boolean {
  const basename = path.trim().toLowerCase().split('/').pop() ?? '';
  if (basename.endsWith('.schema.json') && basename.length > '.schema.json'.length) return true;
  return isToolManagedSchemaPath(path) && basename.endsWith('.json');
}
