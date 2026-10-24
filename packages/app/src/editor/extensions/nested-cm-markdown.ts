import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import type { Extension } from '@codemirror/state';
import { GFM } from '@lezer/markdown';
import { codeLanguages } from '../markdown-code-languages';

export function createMarkdownLanguageExtension(): Extension {
  return markdown({ base: markdownLanguage, extensions: [GFM], codeLanguages });
}
