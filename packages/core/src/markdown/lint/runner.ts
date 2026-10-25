import type { LintPluginFailureReporter } from './plugin-failure.ts';
import { isLintPluginSelected, type LinterConfig } from './plugin-meta.ts';
import { LINT_RUNNER_PLUGINS } from './plugin-runner.ts';
import type { LintDiagnostic } from './types.ts';

export async function lintDocument(
  text: string,
  config: LinterConfig,
  docName?: string,
  onPluginFailure?: LintPluginFailureReporter,
): Promise<LintDiagnostic[]> {
  if (!config.enabled) return [];
  const diagnostics: LintDiagnostic[] = [];
  for (const plugin of LINT_RUNNER_PLUGINS) {
    if (!isLintPluginSelected(config, plugin.id)) continue;
    const slice = config.plugins[plugin.id];
    try {
      diagnostics.push(...(await plugin.lint(text, slice as never, { docName })));
    } catch (err) {
      console.warn(`[lint] plugin "${plugin.id}" failed${docName ? ` on "${docName}"` : ''}`, err);
      onPluginFailure?.({
        source: plugin.id,
        phase: 'lint',
        ...(docName === undefined ? {} : { docName }),
        message: errorMessage(err),
      });
    }
  }
  return diagnostics;
}

export function fixDocument(
  text: string,
  config: LinterConfig,
  docName?: string,
  onPluginFailure?: LintPluginFailureReporter,
): string {
  if (!config.enabled) return text;
  let out = text;
  for (const plugin of LINT_RUNNER_PLUGINS) {
    if (!isLintPluginSelected(config, plugin.id) || !plugin.fix) continue;
    const slice = config.plugins[plugin.id];
    try {
      out = plugin.fix(out, slice as never);
    } catch (err) {
      console.warn(
        `[lint] plugin "${plugin.id}" fix failed${docName ? ` on "${docName}"` : ''}`,
        err,
      );
      onPluginFailure?.({
        source: plugin.id,
        phase: 'fix',
        ...(docName === undefined ? {} : { docName }),
        message: errorMessage(err),
      });
    }
  }
  return out;
}

const MAX_FAILURE_MESSAGE_LENGTH = 500;

function errorMessage(error: unknown): string {
  const raw = renderErrorMessage(error);
  return raw.length > MAX_FAILURE_MESSAGE_LENGTH
    ? `${raw.slice(0, MAX_FAILURE_MESSAGE_LENGTH)}… (truncated)`
    : raw;
}

function renderErrorMessage(error: unknown, depth = 0): string {
  if (error instanceof Error) {
    return error.cause === undefined || depth >= 3
      ? error.message
      : `${error.message} (cause: ${renderErrorMessage(error.cause, depth + 1)})`;
  }
  if (typeof error === 'object' && error !== null) {
    try {
      const json = JSON.stringify(error);
      if (json !== undefined) return json;
    } catch {}
  }
  return String(error);
}
