import { createRequire } from 'node:module';
import type { WorkspaceSearchDocument, WorkspaceSearchIntent } from './workspace-search.ts';

export type WorkspaceSearchFtsColumn = 'title' | 'name' | 'path' | 'pathSegments' | 'content';

export interface WorkspaceSearchFtsBackend {
  readonly name: 'fts5';
  insert(documents: readonly WorkspaceSearchDocument[]): void;
  remove(ids: readonly string[]): void;
  count(): number;
  scores(
    query: string,
    columns: readonly WorkspaceSearchFtsColumn[],
    limit: number,
  ): Map<string, number>;
  ids(): Set<string>;
  close(): void;
}

export interface WorkspaceSearchFtsOptions {
  location?: string;
}

interface SqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
}

interface SqliteStatement {
  run(...params: unknown[]): unknown;
  get(...params: unknown[]): Record<string, unknown> | undefined;
  all(...params: unknown[]): Record<string, unknown>[];
}

type DatabaseSyncCtor = new (location: string) => SqliteDatabase;

const FTS_COLUMNS: readonly WorkspaceSearchFtsColumn[] = [
  'title',
  'name',
  'path',
  'pathSegments',
  'content',
];

const MATCH_TOKEN = /[\p{L}\p{Nd}_]+|\S/iu;

function quoteMatchLiteral(token: string): string {
  return `"${token.replace(/"/g, '""')}"`;
}

const CJK_CHAR =
  /[\u1100-\u11ff\u3130-\u318f\ua960-\ua97f\uac00-\ud7ff\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef\u{20000}-\u{3ffff}]/u;

export function fts5MatchQuery(
  query: string,
  columns: readonly WorkspaceSearchFtsColumn[],
): string | null {
  const tokens: string[] = [];
  const cleaned = query.trim().toLowerCase();
  if (!cleaned) return null;
  let rest = cleaned;
  while (rest.length > 0) {
    const match = MATCH_TOKEN.exec(rest);
    if (match?.index !== 0) return null;
    const token = match[0];
    rest = rest.slice(token.length).trimStart();
    if (/^[\p{L}\p{Nd}_]+$/iu.test(token)) {
      tokens.push(token);
    } else if (token === '"') {
      return null;
    }
  }
  if (tokens.length === 0) return null;
  const cols = columns.length > 0 ? [...columns].sort() : [...FTS_COLUMNS];
  const scoped = (token: string): string => {
    const literal = CJK_CHAR.test(token)
      ? `${quoteMatchLiteral(token)}*`
      : quoteMatchLiteral(token);
    if (cols.length === FTS_COLUMNS.length) return literal;
    return cols.map((column) => `{${column}}:${literal}`).join(' OR ');
  };
  if (tokens.length === 1) return scoped(tokens[0]);
  return tokens.map(scoped).join(' OR ');
}

export function fts5ColumnsForIntent(intent: WorkspaceSearchIntent): WorkspaceSearchFtsColumn[] {
  if (intent === 'full_text') return ['title', 'name', 'path', 'pathSegments', 'content'];
  return ['title', 'name', 'path', 'pathSegments'];
}

function isDatabaseSyncCtor(value: unknown): value is DatabaseSyncCtor {
  return typeof value === 'function';
}

export function loadDatabaseSync(): DatabaseSyncCtor {
  const require = createRequire(import.meta.url);
  const sqlite = require('node:sqlite') as unknown;
  if (
    sqlite &&
    typeof sqlite === 'object' &&
    'DatabaseSync' in sqlite &&
    isDatabaseSyncCtor(sqlite.DatabaseSync)
  ) {
    return sqlite.DatabaseSync;
  }
  throw new Error('node:sqlite DatabaseSync is unavailable');
}

const SCHEMA_SQL = `CREATE VIRTUAL TABLE docs USING fts5(
  id UNINDEXED,
  kind UNINDEXED,
  title,
  name,
  path,
  pathSegments,
  content,
  tokenize='unicode61'
)`;

export function createFts5SearchBackend(
  documents: readonly WorkspaceSearchDocument[],
  options: WorkspaceSearchFtsOptions = {},
): WorkspaceSearchFtsBackend {
  const backend = new Fts5SearchBackend(options.location ?? ':memory:');
  backend.insert(documents);
  return backend;
}

class Fts5SearchBackend implements WorkspaceSearchFtsBackend {
  readonly name = 'fts5' as const;
  private readonly db: SqliteDatabase;
  private readonly insertStmt: SqliteStatement;
  private readonly deleteStmt: SqliteStatement;
  private readonly countStmt: SqliteStatement;
  private readonly idsStmt: SqliteStatement;
  private readonly searchStmt: SqliteStatement;
  private closed = false;

  constructor(location: string) {
    this.db = new (loadDatabaseSync())(location);
    this.db.exec(SCHEMA_SQL);
    this.insertStmt = this.db.prepare(
      'INSERT INTO docs (id, kind, title, name, path, pathSegments, content) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    this.deleteStmt = this.db.prepare('DELETE FROM docs WHERE id = ?');
    this.countStmt = this.db.prepare('SELECT COUNT(*) AS n FROM docs');
    this.idsStmt = this.db.prepare('SELECT id FROM docs');
    this.searchStmt = this.db.prepare(
      'SELECT id, bm25(docs, 0.0, 0.0, 8.0, 7.0, 5.0, 4.0, 1.0) AS score FROM docs WHERE docs MATCH ? ORDER BY rank LIMIT ?',
    );
  }

  private assertOpen(): void {
    if (this.closed) throw new Error('fts5 backend is closed');
  }

  insert(documents: readonly WorkspaceSearchDocument[]): void {
    this.assertOpen();
    this.db.exec('BEGIN');
    try {
      for (const doc of documents) {
        this.insertStmt.run(
          doc.id,
          doc.kind,
          doc.title,
          doc.name,
          doc.path,
          doc.pathSegments,
          doc.content,
        );
      }
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  remove(ids: readonly string[]): void {
    this.assertOpen();
    this.db.exec('BEGIN');
    try {
      for (const id of ids) this.deleteStmt.run(id);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  count(): number {
    this.assertOpen();
    const n = this.countStmt.get()?.n;
    return typeof n === 'number' ? n : 0;
  }

  scores(
    query: string,
    columns: readonly WorkspaceSearchFtsColumn[],
    limit: number,
  ): Map<string, number> {
    this.assertOpen();
    const match = fts5MatchQuery(query, columns);
    const out = new Map<string, number>();
    if (!match) return out;
    for (const row of this.searchStmt.all(match, Math.max(1, limit))) {
      const id = row.id;
      const score = row.score;
      if (typeof id === 'string' && typeof score === 'number') out.set(id, -score);
    }
    return out;
  }

  ids(): Set<string> {
    this.assertOpen();
    const out = new Set<string>();
    for (const row of this.idsStmt.all()) {
      const id = row.id;
      if (typeof id === 'string') out.add(id);
    }
    return out;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.db.close();
  }
}
