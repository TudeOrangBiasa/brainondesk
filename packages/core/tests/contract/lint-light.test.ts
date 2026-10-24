import { execFileSync } from 'node:child_process';
import { describe, expect, test } from 'vitest';

function traceImports(entry: string): Set<string> {
  const script = `
const modules = new Set();
const seen = new Set();
async function visit(spec, parent) {
  const url = new URL(spec, parent).href;
  if (seen.has(url)) return;
  seen.add(url);
  modules.add(url);
  if (!url.startsWith('file:') || url.includes('node_modules')) return;
  const src = await import('node:fs').then((fs) => fs.readFileSync(new URL(url), 'utf8'));
  const noTypes = src.replace(/^\\s*import\\s+type\\s[^;]+;/gm, '');
  const refs = [...noTypes.matchAll(/from\\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
  for (const ref of refs) {
    if (ref.startsWith('.')) await visit(ref.endsWith('.ts') ? ref : ref + '.ts', url);
    else modules.add('pkg:' + ref);
  }
}
await visit(process.argv[1], 'file:///');
console.log([...modules].join('\\n'));
`;
  const out = execFileSync(
    process.execPath,
    ['--input-type=module', '-e', script, new URL(entry, import.meta.url).href],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
  );
  return new Set(out.split('\n').filter(Boolean));
}

describe('lint light entry', () => {
  test('the light entry never pulls the heavy runner graph', () => {
    const modules = traceImports('../../src/markdown/lint/light.ts');
    const heavy = [...modules].filter(
      (m) =>
        m.includes('/frontmatter-validate.ts') ||
        m.includes('/markdownlint-runner.ts') ||
        m.includes('/okf-runner.ts') ||
        m.includes('/okf-rules.ts') ||
        m.includes('/plugin-runner.ts') ||
        m.includes('/runner.ts') ||
        m.includes('/config-schemas.ts') ||
        m.includes('/plugins.ts') ||
        m.startsWith('pkg:ajv') ||
        m.startsWith('pkg:markdownlint') ||
        m.startsWith('pkg:unified') ||
        m.startsWith('pkg:zod') ||
        m === 'pkg:yaml',
    );
    expect(heavy).toEqual([]);
  });

  test('the light entry serves the bindings the app preload path needs', async () => {
    const light = await import('../../src/markdown/lint/light.ts');
    for (const name of [
      'LINT_PLUGINS',
      'DEFAULT_LINTER_CONFIG',
      'isLintPluginSelected',
      'selectGoverningFrontmatterSchemas',
      'selectAdvertisedFrontmatterMappings',
      'selectFrontmatterOnlyConfig',
      'selectApplicableFrontmatterSchemas',
      'toEffectiveBase',
      'isFrontmatterScoped',
    ]) {
      expect(light[name], name).toBeDefined();
    }
    expect(light.LINT_PLUGINS.map((p: { id: string }) => p.id)).toEqual([
      'markdownlint',
      'frontmatter',
      'okf',
    ]);
  });
});
