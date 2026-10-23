import { gzipSync } from 'node:zlib';

const MODULEPRELOAD_RE = /<link\b[^>]*\brel=["']modulepreload["'][^>]*>/gi;
const HREF_RE = /\bhref=["']([^"']+)["']/i;

export function modulepreloadHrefs(indexHtml) {
  const hrefs = [];
  for (const tag of indexHtml.match(MODULEPRELOAD_RE) ?? []) {
    const href = HREF_RE.exec(tag)?.[1];
    if (href && !hrefs.includes(href)) hrefs.push(href);
  }
  return hrefs;
}

export function hrefToDistPath(href) {
  const withoutQuery = href.split('?')[0].split('#')[0];
  return withoutQuery.replace(/^\/+/, '');
}

export function gzipSizeBytes(buffer) {
  return gzipSync(buffer).length;
}

export function summarizeBundle({ hrefs, readFile, distDir }) {
  const modules = [];
  const missing = [];
  for (const href of hrefs) {
    const rel = hrefToDistPath(href);
    let bytes = null;
    try {
      bytes = readFile(`${distDir}/${rel}`);
    } catch {
      missing.push(rel);
      continue;
    }
    modules.push({ href, path: rel, rawBytes: bytes.length, gzipBytes: gzipSizeBytes(bytes) });
  }
  const rawBytes = modules.reduce((sum, m) => sum + m.rawBytes, 0);
  const gzipBytes = modules.reduce((sum, m) => sum + m.gzipBytes, 0);
  return { moduleCount: modules.length, rawBytes, gzipBytes, modules, missing };
}

export function bytesToKB(bytes) {
  return bytes / 1024;
}
