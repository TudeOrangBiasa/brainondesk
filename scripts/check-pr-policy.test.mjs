import { describe, expect, it } from 'vitest';
import {
  checkLinkedIssue,
  checkProtectedPaths,
  checkTitle,
  evaluatePolicy,
  parseLabels,
} from './check-pr-policy.mjs';

describe('checkTitle', () => {
  it.each([
    'feat: add office tab',
    'fix(office): keep etag on save',
    'ci(verify)!: require gate',
    'chore(deps): bump vite',
  ])('accepts %s', (title) => {
    expect(checkTitle(title)).toEqual([]);
  });

  it.each(['Add office tab', 'feature: x', 'feat:missing space', 'feat(Office): x', 'feat: '])(
    'rejects %s',
    (title) => {
      expect(checkTitle(title)).toHaveLength(1);
    },
  );
});

describe('checkLinkedIssue', () => {
  it.each(['Closes #12', 'fixes #3 and more', 'Resolved: #40', 'text\n\nclose #1'])(
    'accepts %s',
    (body) => {
      expect(checkLinkedIssue(body, [])).toEqual([]);
    },
  );

  it('rejects a body without a closing keyword', () => {
    expect(checkLinkedIssue('see #12', [])).toHaveLength(1);
  });

  it('allows the no-issue label', () => {
    expect(checkLinkedIssue('', ['no-issue'])).toEqual([]);
  });
});

describe('checkProtectedPaths', () => {
  const files = ['packages/app/src/a.ts', '.github/workflows/verify.yml', 'NOTICE'];

  it('flags protected files without the label', () => {
    const [problem] = checkProtectedPaths(files, []);
    expect(problem).toContain('.github/workflows/verify.yml');
    expect(problem).toContain('NOTICE');
    expect(problem).not.toContain('packages/app');
  });

  it('passes with the label', () => {
    expect(checkProtectedPaths(files, ['protected-paths-ok'])).toEqual([]);
  });

  it('flags vendored upstream license files', () => {
    expect(checkProtectedPaths(['packages/office-docx/LICENSE.upstream'], [])).toHaveLength(1);
  });

  it('ignores ordinary files', () => {
    expect(checkProtectedPaths(['docs/office/PLAN.md', 'packages/core/src/x.ts'], [])).toEqual([]);
  });
});

describe('parseLabels', () => {
  it('parses a JSON array of label objects', () => {
    expect(parseLabels('[{"name":"no-issue"},{"name":"bug"}]')).toEqual(['no-issue', 'bug']);
  });

  it('parses a comma list', () => {
    expect(parseLabels('no-issue, protected-paths-ok')).toEqual(['no-issue', 'protected-paths-ok']);
  });

  it('returns an empty list for nothing', () => {
    expect(parseLabels(undefined)).toEqual([]);
  });
});

describe('evaluatePolicy', () => {
  it('reports every violation', () => {
    expect(evaluatePolicy({ title: 'x', body: '', labels: [], files: ['LICENSE'] })).toHaveLength(
      3,
    );
  });
});
