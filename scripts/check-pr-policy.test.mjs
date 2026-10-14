import { describe, expect, it } from 'vitest';
import {
  checkLinkedIssue,
  checkProtectedPaths,
  checkRiskLabel,
  checkTitle,
  evaluatePolicy,
  parseLabels,
  parseNumstat,
  renderSuggestion,
  riskWarnings,
  suggestRisk,
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

  it('flags protected files given as numstat entries', () => {
    const [problem] = checkProtectedPaths([{ path: '.github/workflows/verify.yml', lines: 3 }], []);
    expect(problem).toContain('.github/workflows/verify.yml');
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
      4,
    );
  });
});

describe('checkRiskLabel', () => {
  it('accepts low for ordinary files', () => {
    expect(checkRiskLabel('feat: x', ['risk:low'], ['packages/app/src/a.ts'])).toEqual([]);
  });

  it('accepts high for anything', () => {
    expect(checkRiskLabel('feat!: x', ['risk:high'], ['NOTICE'])).toEqual([]);
  });

  it('rejects a missing label', () => {
    expect(checkRiskLabel('feat: x', [], ['packages/app/src/a.ts'])).toHaveLength(1);
  });

  it('rejects both labels', () => {
    expect(checkRiskLabel('feat: x', ['risk:low', 'risk:high'], [])).toHaveLength(1);
  });

  it('rejects low on protected paths', () => {
    expect(checkRiskLabel('chore: x', ['risk:low'], ['NOTICE'])).toHaveLength(1);
  });

  it('rejects low on breaking changes', () => {
    expect(checkRiskLabel('feat!: x', ['risk:low'], ['packages/app/src/a.ts'])).toHaveLength(1);
  });
});

describe('suggestRisk', () => {
  it('suggests low when no rule matches', () => {
    const suggestion = suggestRisk({ title: 'fix(app): x', files: ['packages/app/src/a.ts'] });
    expect(suggestion.label).toBe('risk:low');
    expect(suggestion.reasons).toEqual([]);
  });

  it.each([
    ['.github/workflows/verify.yml', 'ci'],
    ['scripts/verify.sh', 'ci'],
    ['lint-plugins/no-comments/allowlist.mjs', 'ci'],
    ['packages/office-docx/NOTICE.upstream', 'license'],
    ['pnpm-lock.yaml', 'deps'],
    ['packages/app/package.json', 'deps'],
    ['packages/cli/src/auth/token-store.ts', 'auth'],
    ['packages/desktop/src/main/keyring-store.ts', 'auth'],
    ['packages/core/src/config/schema.ts', 'data'],
    ['packages/desktop/electron-builder.linux.yml', 'config'],
    ['packages/server/src/mcp/tools/read.ts', 'contract'],
    ['packages/cli/src/commands/init.ts', 'contract'],
  ])('flags %s as %s', (path, id) => {
    const suggestion = suggestRisk({ files: [path] });
    expect(suggestion.label).toBe('risk:high');
    expect(suggestion.reasons.map((reason) => reason.id)).toContain(id);
  });

  it('ignores tests and docs for the soft rules', () => {
    const files = [
      'packages/cli/src/auth/token-store.test.ts',
      'docs/content/remote-control/auth-setup.md',
    ];
    expect(suggestRisk({ files }).label).toBe('risk:low');
  });

  it('flags a breaking title', () => {
    expect(suggestRisk({ title: 'feat(cli)!: drop flag', files: [] }).reasons[0].id).toBe(
      'breaking',
    );
  });

  it('flags a large diff but skips lockfiles and locales', () => {
    const big = [{ path: 'packages/app/src/a.ts', lines: 401 }];
    expect(suggestRisk({ files: big }).reasons.map((r) => r.id)).toEqual(['size']);
    const noise = [
      { path: 'pnpm-lock.yaml', lines: 5000 },
      { path: 'packages/app/src/locales/id/messages.po', lines: 900 },
    ];
    expect(suggestRisk({ files: noise }).reasons.map((r) => r.id)).toEqual(['deps']);
  });

  it('flags more than 15 files', () => {
    const files = Array.from({ length: 16 }, (_, i) => ({
      path: `packages/app/src/f${i}.ts`,
      lines: 1,
    }));
    expect(suggestRisk({ files }).reasons.map((r) => r.id)).toEqual(['size']);
  });

  it('renders the suggestion with matched files', () => {
    const text = renderSuggestion(suggestRisk({ files: ['.github/workflows/verify.yml'] }));
    expect(text).toContain('Suggested risk label: risk:high');
    expect(text).toContain('.github/workflows/verify.yml');
  });
});

describe('risk label vs suggestion', () => {
  it('rejects low on a CI change', () => {
    expect(checkRiskLabel('ci: x', ['risk:low'], ['scripts/verify.sh'])).toHaveLength(1);
  });

  it('rejects low on a large diff', () => {
    expect(
      checkRiskLabel('feat: x', ['risk:low'], [{ path: 'packages/app/src/a.ts', lines: 900 }]),
    ).toHaveLength(1);
  });

  it('allows low on a soft rule but warns', () => {
    const files = ['packages/cli/src/commands/init.ts'];
    expect(checkRiskLabel('fix(cli): x', ['risk:low'], files)).toEqual([]);
    expect(riskWarnings('fix(cli): x', ['risk:low'], files)).toHaveLength(1);
  });

  it('names the suggestion when the label is missing', () => {
    const [problem] = checkRiskLabel('fix: x', [], ['.github/workflows/verify.yml']);
    expect(problem).toContain('Suggested from changed paths: "risk:high"');
  });

  it('never tells agents they may merge', () => {
    const [problem] = checkRiskLabel('fix: x', [], ['packages/app/src/a.ts']);
    expect(problem).not.toMatch(/agents? may merge/i);
  });
});

describe('evaluatePolicy with numstat entries', () => {
  it('still requires protected-paths-ok', () => {
    const problems = evaluatePolicy({
      title: 'ci: x',
      body: 'Closes #1',
      labels: ['risk:high'],
      files: parseNumstat('3\t1\t.github/workflows/verify.yml\n'),
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('protected-paths-ok');
  });
});

describe('parseNumstat', () => {
  it('sums added and removed lines and treats binary as zero', () => {
    expect(parseNumstat('3\t2\ta.ts\n-\t-\timg.png\n')).toEqual([
      { path: 'a.ts', lines: 5 },
      { path: 'img.png', lines: 0 },
    ]);
  });
});
