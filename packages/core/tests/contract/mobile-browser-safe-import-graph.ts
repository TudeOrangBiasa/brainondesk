import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { builtinModules, createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MOBILE_BROWSER_SAFE_SUBPATHS } from './mobile-browser-safe-subpaths.ts';

type TsNode = {
  kind: number;
  importClause?: {
    isTypeOnly: boolean;
    name?: unknown;
    namedBindings?: TsNode & { elements?: Array<{ isTypeOnly: boolean }> };
  };
  moduleSpecifier?: { text?: string };
  isTypeOnly?: boolean;
  exportClause?: TsNode & { elements?: Array<{ isTypeOnly: boolean }> };
  moduleReference?: { expression?: { text?: string } };
  expression?: TsNode;
  arguments?: TsNode[];
  text?: string;
};

type TypescriptApi = {
  ScriptTarget: { Latest: number };
  ScriptKind: { TS: number; TSX: number; JS: number; JSX: number };
  SyntaxKind: { ImportKeyword: number };
  createSourceFile: (
    fileName: string,
    sourceText: string,
    languageVersion: number,
    setParentNodes: boolean,
    scriptKind: number,
  ) => TsNode;
  forEachChild: (node: TsNode, visitor: (child: TsNode) => void) => void;
  isImportDeclaration: (node: TsNode) => node is TsNode & { moduleSpecifier: { text: string } };
  isExportDeclaration: (node: TsNode) => node is TsNode;
  isImportEqualsDeclaration: (node: TsNode) => node is TsNode;
  isCallExpression: (node: TsNode) => node is TsNode & { expression: TsNode; arguments: TsNode[] };
  isStringLiteral: (node: TsNode) => node is TsNode & { text: string };
  isIdentifier: (node: TsNode) => node is TsNode & { text: string };
  isNamespaceImport: (node: TsNode) => boolean;
  isNamespaceExport: (node: TsNode) => boolean;
  isExternalModuleReference: (node: TsNode) => node is TsNode & { expression: { text: string } };
};

const requireFromWorkspaceRoot = createRequire(
  fileURLToPath(new URL('../../../../package.json', import.meta.url)),
);
const ts = requireFromWorkspaceRoot('typescript') as TypescriptApi;

const CORE_PACKAGE = '@inkeep/open-knowledge-core';
const SOURCE_CONDITION = '@inkeep/source';
const CORE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PARSE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);

const NODE_BUILTINS = new Set<string>();
for (const name of builtinModules) {
  NODE_BUILTINS.add(name);
  NODE_BUILTINS.add(`node:${name}`);
}

export type NodeBuiltinImport = {
  importer: string;
  specifier: string;
};

export type ImportGraphRead = (absolutePath: string) => string;

type PackageExports = Record<string, unknown>;

let packageExports: PackageExports | undefined;

function readPackageExports(): PackageExports {
  if (packageExports) return packageExports;
  const pkg = JSON.parse(readFileSync(path.join(CORE_ROOT, 'package.json'), 'utf8')) as {
    exports?: PackageExports;
  };
  packageExports = pkg.exports ?? {};
  return packageExports;
}

function sourceTarget(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (SOURCE_CONDITION in record) return sourceTarget(record[SOURCE_CONDITION]);
  return null;
}

export function mobileSubpathSourceFile(subpath: string): string {
  const target = sourceTarget(readPackageExports()[subpath]);
  if (!target) {
    throw new Error(`${CORE_PACKAGE} has no ${SOURCE_CONDITION} export for ${subpath}`);
  }
  const absolute = path.resolve(CORE_ROOT, target);
  if (!existsSync(absolute)) {
    throw new Error(`${subpath} export target does not exist: ${absolute}`);
  }
  return realpathSync(absolute);
}

function isNodeBuiltin(specifier: string): boolean {
  if (specifier.startsWith('node:')) return true;
  return NODE_BUILTINS.has(specifier);
}

function scriptKind(file: string): number {
  if (file.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (file.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (file.endsWith('.ts') || file.endsWith('.mts') || file.endsWith('.cts')) {
    return ts.ScriptKind.TS;
  }
  return ts.ScriptKind.JS;
}

function namedImportIsValue(node: TsNode): boolean {
  const clause = node.importClause;
  if (!clause) return true;
  if (clause.isTypeOnly) return false;
  if (clause.name) return true;
  const bindings = clause.namedBindings;
  if (!bindings) return true;
  if (ts.isNamespaceImport(bindings)) return true;
  return bindings.elements.some((element) => !element.isTypeOnly);
}

function exportFromIsValue(node: TsNode): boolean {
  if (node.isTypeOnly) return false;
  const clause = node.exportClause;
  if (!clause || ts.isNamespaceExport(clause)) return true;
  return clause.elements.some((element) => !element.isTypeOnly);
}

function valueSpecifiers(source: TsNode): string[] {
  const specifiers: string[] = [];
  const visit = (node: TsNode): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      if (namedImportIsValue(node)) specifiers.push(node.moduleSpecifier.text);
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      exportFromIsValue(node)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      !node.isTypeOnly &&
      node.moduleReference &&
      ts.isExternalModuleReference(node.moduleReference) &&
      ts.isStringLiteral(node.moduleReference.expression)
    ) {
      specifiers.push(node.moduleReference.expression.text);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text);
    } else if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'require' &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      specifiers.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return specifiers;
}

function findFile(base: string): string | null {
  const extension = path.extname(base);
  const candidates =
    extension.length > 0
      ? [base]
      : [
          `${base}.ts`,
          `${base}.tsx`,
          `${base}.mts`,
          `${base}.js`,
          `${base}.mjs`,
          `${base}.cjs`,
          `${base}.json`,
          path.join(base, 'index.ts'),
          path.join(base, 'index.tsx'),
          path.join(base, 'index.js'),
          path.join(base, 'index.mjs'),
        ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return realpathSync(candidate);
  }
  return null;
}

function coreSpecifierSubpath(specifier: string): string | null {
  if (specifier === CORE_PACKAGE) return '.';
  const prefix = `${CORE_PACKAGE}/`;
  if (specifier.startsWith(prefix)) return `./${specifier.slice(prefix.length)}`;
  return null;
}

function resolveSpecifier(fromFile: string, specifier: string): string | null {
  if (specifier.startsWith('.')) {
    const resolved = findFile(path.resolve(path.dirname(fromFile), specifier));
    if (!resolved) {
      throw new Error(`unresolved import "${specifier}" from ${fromFile}`);
    }
    return resolved.includes(`${path.sep}node_modules${path.sep}`) ? null : resolved;
  }
  const subpath = coreSpecifierSubpath(specifier);
  if (!subpath) return null;
  return mobileSubpathSourceFile(subpath);
}

function shouldParse(file: string): boolean {
  return PARSE_EXTENSIONS.has(path.extname(file));
}

export function collectNodeBuiltinImports(options?: {
  subpaths?: readonly string[];
  readText?: ImportGraphRead;
}): NodeBuiltinImport[] {
  const subpaths = options?.subpaths ?? MOBILE_BROWSER_SAFE_SUBPATHS;
  const readText = options?.readText ?? ((file) => readFileSync(file, 'utf8'));
  const visited = new Set<string>();
  const seen = new Set<string>();
  const violations: NodeBuiltinImport[] = [];

  const walk = (file: string): void => {
    if (visited.has(file)) return;
    visited.add(file);
    if (!shouldParse(file)) return;
    const source = ts.createSourceFile(
      file,
      readText(file),
      ts.ScriptTarget.Latest,
      true,
      scriptKind(file),
    );
    for (const specifier of valueSpecifiers(source)) {
      if (isNodeBuiltin(specifier)) {
        const key = `${file}\0${specifier}`;
        if (!seen.has(key)) {
          seen.add(key);
          violations.push({ importer: file, specifier });
        }
        continue;
      }
      const next = resolveSpecifier(file, specifier);
      if (next) walk(next);
    }
  };

  for (const subpath of subpaths) {
    walk(mobileSubpathSourceFile(subpath));
  }

  violations.sort((left, right) => {
    const byFile = left.importer.localeCompare(right.importer);
    return byFile === 0 ? left.specifier.localeCompare(right.specifier) : byFile;
  });
  return violations;
}
