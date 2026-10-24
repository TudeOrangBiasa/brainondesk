import type { MermaidLike } from '@visimer/dom';
import { createRetryingLoader } from '@/lib/retrying-loader.ts';

export type MermaidApi = MermaidLike;

export const loadMermaid = createRetryingLoader(() => import('mermaid').then((mod) => mod.default));

export const loadWysiwyg = createRetryingLoader(() =>
  Promise.all([import('@visimer/core'), import('@visimer/dom')]),
);

export const MERMAID_DARK_THEME_VARIABLES = {
  fontFamily:
    'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
  background: '#0b0b0d',
  primaryColor: '#1c1c1f',
  primaryTextColor: '#f5f5f7',
  primaryBorderColor: '#2a2a2e',
  secondaryColor: '#242427',
  secondaryTextColor: '#f5f5f7',
  secondaryBorderColor: '#2a2a2e',
  tertiaryColor: '#2c2c30',
  tertiaryTextColor: '#f5f5f7',
  tertiaryBorderColor: '#2a2a2e',
  mainBkg: '#1c1c1f',
  lineColor: '#5a5a63',
  textColor: '#f5f5f7',
  actorBkg: '#1c1c1f',
  actorBorder: '#2a2a2e',
  actorTextColor: '#f5f5f7',
  actorLineColor: '#4a4a52',
  signalColor: '#8b8b93',
  signalTextColor: '#a1a1a9',
  labelBoxBkgColor: '#1c1c1f',
  labelBoxBorderColor: '#4a4a52',
  labelTextColor: '#a1a1a9',
  loopTextColor: '#a1a1a9',
  nodeBorder: '#1c1c1f',
  clusterBkg: '#141416',
  clusterBorder: '#2a2a2e',
  defaultLinkColor: '#5a5a63',
  edgeLabelBackground: '#0b0b0d',
  titleColor: '#a1a1a9',
  noteBkgColor: '#c88a1e',
  noteTextColor: '#ffffff',
  noteBorderColor: '#c88a1e',
  activationBkgColor: '#2c2c30',
  activationBorderColor: '#3a3a40',
} as const;

export function mermaidConfigFor(colorMode: 'light' | 'dark'): Record<string, unknown> {
  return {
    startOnLoad: false,
    securityLevel: 'strict',
    theme: colorMode === 'dark' ? 'dark' : 'default',
    themeVariables: colorMode === 'dark' ? MERMAID_DARK_THEME_VARIABLES : undefined,
    suppressErrorRendering: true,
  };
}
