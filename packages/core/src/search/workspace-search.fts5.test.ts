import { describe, expect, test } from 'vitest';
import { createFts5SearchBackend, fts5MatchQuery } from './workspace-search.fts5.ts';
import { createWorkspaceSearchDocument, type WorkspaceSearchDocument } from './workspace-search.ts';

function page(path: string, title: string, content: string): WorkspaceSearchDocument {
  return createWorkspaceSearchDocument({ kind: 'page', path, title, content, modifiedTs: 1 });
}

describe('fts5MatchQuery', () => {
  test('scopes a single token to the given columns', () => {
    expect(fts5MatchQuery('hello', ['title', 'content'])).toBe(
      '{content}:"hello" OR {title}:"hello"',
    );
  });

  test('joins multi-token queries with OR', () => {
    expect(
      fts5MatchQuery('hello dunia', ['title', 'name', 'path', 'pathSegments', 'content']),
    ).toBe('"hello" OR "dunia"');
  });

  test('returns null for empty queries and skips ASCII punctuation', () => {
    expect(fts5MatchQuery('   ', ['title'])).toBeNull();
    expect(fts5MatchQuery('...', ['title'])).toBeNull();
    expect(fts5MatchQuery('hello, dunia!', ['content'])).toBe(
      '{content}:"hello" OR {content}:"dunia"',
    );
  });

  test('neutralizes quote and paren injection', () => {
    expect(fts5MatchQuery('alpha) OR (1=1', ['content'])).toBe(
      '{content}:"alpha" OR {content}:"or" OR {content}:"1" OR {content}:"1"',
    );
  });
});

describe('createFts5SearchBackend', () => {
  test('finds content matches with positive scores', () => {
    const backend = createFts5SearchBackend([
      page('a/one', 'Alpha', 'the quick brown fox'),
      page('b/two', 'Beta', 'unrelated text here'),
    ]);
    try {
      expect(backend.name).toBe('fts5');
      expect(backend.count()).toBe(2);
      const scores = backend.scores('quick fox', ['content'], 10);
      expect([...scores.keys()]).toEqual(['page:a/one']);
      expect(scores.get('page:a/one')).toBeGreaterThan(0);
    } finally {
      backend.close();
    }
  });

  test('respects column scoping', () => {
    const backend = createFts5SearchBackend([page('a/one', 'Zebra', 'plain body')]);
    try {
      expect(backend.scores('zebra', ['content'], 10).size).toBe(0);
      expect(backend.scores('zebra', ['title'], 10).size).toBe(1);
    } finally {
      backend.close();
    }
  });

  test('insert and remove keep the index searchable', () => {
    const backend = createFts5SearchBackend([page('a/one', 'Alpha', 'first')]);
    try {
      backend.insert([page('b/two', 'Beta', 'quokka habitat')]);
      expect(backend.count()).toBe(2);
      expect(backend.scores('quokka', ['content'], 10).has('page:b/two')).toBe(true);
      backend.remove(['page:b/two']);
      expect(backend.count()).toBe(1);
      expect(backend.scores('quokka', ['content'], 10).size).toBe(0);
    } finally {
      backend.close();
    }
  });

  test('non-latin content is searchable', () => {
    const backend = createFts5SearchBackend([page('notes/cjk', 'CJK', '访问控制策略说明')]);
    try {
      expect(backend.scores('访问控制', ['content'], 10).has('page:notes/cjk')).toBe(true);
    } finally {
      backend.close();
    }
  });
});
