import type {
  LintDiagnostic,
  LinterConfig,
  LintPluginFailureReporter,
} from '@inkeep/open-knowledge-core/markdown/lint/light';
import { createRetryingLoader } from '@/lib/retrying-loader.ts';

const loadLintRunner = createRetryingLoader(
  () => import('@inkeep/open-knowledge-core/markdown/lint'),
);

export async function lintDocumentLazy(
  text: string,
  config: LinterConfig,
  docName?: string,
  onPluginFailure?: LintPluginFailureReporter,
): Promise<LintDiagnostic[]> {
  const runner = await loadLintRunner();
  return runner.lintDocument(text, config, docName, onPluginFailure);
}

export function preloadLintRunner(): void {
  void loadLintRunner().catch(() => undefined);
}
