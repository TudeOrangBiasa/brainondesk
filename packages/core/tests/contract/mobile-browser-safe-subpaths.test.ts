import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import {
  collectNodeBuiltinImports,
  mobileSubpathSourceFile,
} from './mobile-browser-safe-import-graph.ts';
import { MOBILE_BROWSER_SAFE_SUBPATHS } from './mobile-browser-safe-subpaths.ts';

const INITIAL_MOBILE_BROWSER_SAFE_SUBPATHS = [
  './markdown',
  './extensions/wiki-link',
  './extensions/tag',
  './extensions/frontmatter',
  './utils/wiki-link-resolve',
  './utils/slug',
  './frontmatter/schema',
  './constants/upload',
  './constants/github',
  './registry',
  './search/workspace-search',
  './markdown/lint',
  './bridge',
  './config/auto-sync-mode',
] as const;

it('keeps the initial mobile browser-safe subpath list extensible', () => {
  for (const subpath of INITIAL_MOBILE_BROWSER_SAFE_SUBPATHS) {
    expect(MOBILE_BROWSER_SAFE_SUBPATHS).toContain(subpath);
  }
});

it('finds no Node builtin in the mobile subpath import graph', () => {
  const violations = collectNodeBuiltinImports();
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
});

it('fails when a listed subpath adds a node:fs import', () => {
  const slug = mobileSubpathSourceFile('./utils/slug');
  const violations = collectNodeBuiltinImports({
    subpaths: ['./utils/slug'],
    readText(file) {
      const text = readFileSync(file, 'utf8');
      return file === slug ? `${text}\nimport 'node:fs';\n` : text;
    },
  });
  expect(violations).toContainEqual({ importer: slug, specifier: 'node:fs' });
});

it('ignores a type-only Node import because it is erased', () => {
  const slug = mobileSubpathSourceFile('./utils/slug');
  const violations = collectNodeBuiltinImports({
    subpaths: ['./utils/slug'],
    readText(file) {
      const text = readFileSync(file, 'utf8');
      return file === slug ? `${text}\nimport type { Dirent } from 'node:fs';\n` : text;
    },
  });
  expect(violations).toEqual([]);
});
