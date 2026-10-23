import { describe, expect, test } from 'vitest';
import { gzipSync } from 'node:zlib';
import {
  bytesToKB,
  gzipSizeBytes,
  hrefToDistPath,
  modulepreloadHrefs,
  summarizeBundle,
} from './bundle-probe.mjs';

const INDEX_HTML = [
  '<!doctype html>',
  '<html><head>',
  '<link rel="modulepreload" href="/assets/index-AbC123.js" />',
  "<link href='/assets/vendor-XyZ.js?x=1' rel='modulepreload'>",
  '<link rel="stylesheet" href="/assets/index.css" />',
  '<link rel="modulepreload" href="/assets/index-AbC123.js" />',
  '</head></html>',
].join('\n');

describe('modulepreloadHrefs', () => {
  test('collects modulepreload hrefs, deduped, in order', () => {
    expect(modulepreloadHrefs(INDEX_HTML)).toEqual(['/assets/index-AbC123.js', '/assets/vendor-XyZ.js?x=1']);
  });

  test('empty page yields no hrefs', () => {
    expect(modulepreloadHrefs('<html></html>')).toEqual([]);
  });
});

describe('hrefToDistPath', () => {
  test('strips leading slash, query, and hash', () => {
    expect(hrefToDistPath('/assets/a.js?x=1#y')).toBe('assets/a.js');
    expect(hrefToDistPath('assets/b.js')).toBe('assets/b.js');
  });
});

describe('gzipSizeBytes', () => {
  test('matches zlib gzip output length', () => {
    const buf = Buffer.from('x'.repeat(1000));
    expect(gzipSizeBytes(buf)).toBe(gzipSync(buf).length);
  });
});

describe('summarizeBundle', () => {
  test('sums raw+gzip across modules and reports missing files', () => {
    const files = new Map([
      ['dist/assets/a.js', Buffer.from('a'.repeat(100))],
      ['dist/assets/b.js', Buffer.from('b'.repeat(50))],
    ]);
    const summary = summarizeBundle({
      hrefs: ['/assets/a.js', '/assets/b.js', '/assets/gone.js'],
      distDir: 'dist',
      readFile: (path) => {
        const hit = files.get(path);
        if (!hit) throw new Error('ENOENT');
        return hit;
      },
    });
    expect(summary.moduleCount).toBe(2);
    expect(summary.rawBytes).toBe(150);
    expect(summary.gzipBytes).toBe(gzipSync(files.get('dist/assets/a.js')).length + gzipSync(files.get('dist/assets/b.js')).length);
    expect(summary.missing).toEqual(['assets/gone.js']);
  });
});

describe('bytesToKB', () => {
  test('divides by 1024', () => {
    expect(bytesToKB(2048)).toBe(2);
  });
});
