import { HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';

export const propEditorHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--syntax-keyword)', fontWeight: '600' },
  { tag: tags.controlKeyword, color: 'var(--syntax-keyword)', fontWeight: '600' },
  { tag: tags.modifier, color: 'var(--syntax-keyword)' },
  { tag: tags.tagName, color: 'var(--syntax-tag)' },
  { tag: tags.typeName, color: 'var(--syntax-tag)' },
  { tag: tags.className, color: 'var(--syntax-tag)' },
  { tag: tags.attributeName, color: 'var(--syntax-attr)' },
  { tag: tags.propertyName, color: 'var(--syntax-attr)' },
  { tag: tags.variableName, color: 'var(--syntax-attr)' },
  { tag: tags.string, color: 'var(--syntax-string)' },
  { tag: tags.number, color: 'var(--syntax-number)' },
  { tag: tags.bool, color: 'var(--syntax-number)' },
  { tag: tags.null, color: 'var(--syntax-number)' },
  { tag: tags.atom, color: 'var(--syntax-atom)' },
  { tag: tags.literal, color: 'var(--syntax-number)' },
  { tag: tags.operator, color: 'var(--syntax-keyword)' },
  { tag: tags.punctuation, color: 'var(--foreground)' },
  { tag: tags.bracket, color: 'var(--foreground)' },
  { tag: tags.brace, color: 'var(--foreground)' },
  { tag: tags.meta, color: 'var(--muted-foreground)' },
  { tag: tags.comment, color: 'var(--muted-foreground)', fontStyle: 'italic' },
]);
