const LINT_CONFIG_CHANGED_EVENT = 'open-knowledge:lint-config-changed';

export function emitLintConfigChanged(): void {
  window.dispatchEvent(new CustomEvent(LINT_CONFIG_CHANGED_EVENT));
}

export function subscribeToLintConfigChanged(onChange: () => void): () => void {
  const listener = () => onChange();
  window.addEventListener(LINT_CONFIG_CHANGED_EVENT, listener);
  return () => window.removeEventListener(LINT_CONFIG_CHANGED_EVENT, listener);
}
