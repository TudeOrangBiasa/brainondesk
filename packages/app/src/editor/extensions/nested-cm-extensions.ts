import { Compartment, type Extension } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import type * as Y from 'yjs';
import { createRetryingLoader } from '@/lib/retrying-loader.ts';
import { createAgentFlashSourceExtension } from '../plugins/agent-flash-source';
import { createMdLinkSourceExtension } from '../plugins/md-link-source';
import { createWikiLinkSourceExtension } from '../plugins/wiki-link-source';
import { okCmTheme } from './cm-theme';

export const darkTheme: Extension = okCmTheme({ dark: true });
export const lightTheme: Extension = okCmTheme({ dark: false });

export const nestedCMLanguageCompartment = new Compartment();

interface NestedCMOptions {
  themeCompartment: Compartment;
  resolvedTheme: string | undefined;
  ydoc?: Y.Doc;
  wordWrapCompartment?: Compartment;
  wordWrap?: boolean;
  extraKeymaps?: Extension;
  currentDocName?: string | null;
}

export function createNestedCMExtensions(options: NestedCMOptions): Extension[] {
  const { themeCompartment, resolvedTheme, ydoc } = options;
  const theme = resolvedTheme === 'dark' ? darkTheme : lightTheme;
  const wordWrapExtension: Extension = (options.wordWrap ?? true) ? EditorView.lineWrapping : [];

  return [
    nestedCMLanguageCompartment.of([]),
    createWikiLinkSourceExtension(options.currentDocName ?? null),
    createMdLinkSourceExtension(),
    ...(ydoc ? [createAgentFlashSourceExtension(ydoc)] : []),
    keymap.of([]),
    themeCompartment.of(theme),
    options.wordWrapCompartment
      ? options.wordWrapCompartment.of(wordWrapExtension)
      : wordWrapExtension,
    ...(options.extraKeymaps ? [options.extraKeymaps] : []),
  ];
}

const loadMarkdownLanguage = createRetryingLoader(() => import('./nested-cm-markdown.ts'));

export async function loadNestedCMMarkdownLanguage(): Promise<Extension> {
  const mod = await loadMarkdownLanguage();
  return mod.createMarkdownLanguageExtension();
}
