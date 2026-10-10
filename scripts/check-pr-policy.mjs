import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const CONVENTIONAL_TYPES = [
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'perf',
  'test',
  'build',
  'ci',
  'chore',
  'revert',
];

export const RISK_LOW_LABEL = 'risk:low';
export const RISK_HIGH_LABEL = 'risk:high';
export const NO_ISSUE_LABEL = 'no-issue';
export const PROTECTED_PATHS_LABEL = 'protected-paths-ok';

export const PROTECTED_PATH_PATTERNS = [
  /^\.github\/workflows\//,
  /^\.github\/actions\//,
  /^\.github\/CODEOWNERS$/,
  /^LICENSE(\..*)?$/,
  /^LICENSES\//,
  /^NOTICE(\..*)?$/,
  /^THIRD_PARTY_NOTICES\.md$/,
  /^scripts\/verify\.sh$/,
  /^scripts\/check-pr-policy\.mjs$/,
  /(^|\/)LICENSE\.upstream$/,
  /(^|\/)NOTICE\.upstream$/,
];

const TITLE_PATTERN = new RegExp(
  `^(${CONVENTIONAL_TYPES.join('|')})(\\([a-z0-9][a-z0-9._/-]*\\))?!?: \\S.*$`,
);

const LINKED_ISSUE_PATTERN = /\b(close[sd]?|fix(e[sd])?|resolve[sd]?)\s*:?\s+#\d+\b/i;
export function checkTitle(title) {
  if (TITLE_PATTERN.test(title.trim())) return [];
  return [
    `PR title "${title}" is not a Conventional Commit title. Use "<type>(<scope>): <summary>" with type one of ${CONVENTIONAL_TYPES.join(', ')}.`,
  ];
}
export function checkLinkedIssue(body, labels) {
  if (labels.includes(NO_ISSUE_LABEL)) return [];
  if (LINKED_ISSUE_PATTERN.test(body)) return [];
  return [
    `PR body must link an issue with "Closes #N" (or Fixes/Resolves). For a PR with no issue, add the "${NO_ISSUE_LABEL}" label.`,
  ];
}

export function protectedFiles(files) {
  return files.filter((file) => PROTECTED_PATH_PATTERNS.some((pattern) => pattern.test(file)));
}
export function checkProtectedPaths(files, labels) {
  const touched = protectedFiles(files);
  if (touched.length === 0 || labels.includes(PROTECTED_PATHS_LABEL)) return [];
  const shown = touched.slice(0, 10).join(', ');
  const more = touched.length > 10 ? ` and ${touched.length - 10} more` : '';
  return [
    `PR changes protected paths without the "${PROTECTED_PATHS_LABEL}" label (a human adds it after review): ${shown}${more}`,
  ];
}

export function checkRiskLabel(title, labels, files) {
  const hasLow = labels.includes(RISK_LOW_LABEL);
  const hasHigh = labels.includes(RISK_HIGH_LABEL);
  if (hasLow && hasHigh) {
    return [`PR must carry exactly one risk label ("${RISK_LOW_LABEL}" or "${RISK_HIGH_LABEL}"), not both.`];
  }
  if (!hasLow && !hasHigh) {
    return [`PR must carry a risk label ("${RISK_LOW_LABEL}" or "${RISK_HIGH_LABEL}"). Low-risk PRs may be merged by agents once verify is green; high-risk PRs need human review.`];
  }
  if (hasLow) {
    const breaking = title.includes('!');
    const touched = protectedFiles(files);
    if (breaking || touched.length > 0) {
      const why = [breaking ? 'breaking change (!)' : null, touched.length > 0 ? 'protected paths' : null].filter(Boolean).join(' and ');
      return [`PR labeled "${RISK_LOW_LABEL}" touches ${why}; relabel as "${RISK_HIGH_LABEL}" for human review.`];
    }
  }
  return [];
}


export function parseLabels(raw) {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    return JSON.parse(trimmed).map((label) => (typeof label === 'string' ? label : label.name));
  }
  return trimmed
    .split(',')
    .map((label) => label.trim())
    .filter(Boolean);
}

export function evaluatePolicy({ title, body, labels, files }) {
  return [
    ...checkTitle(title),
    ...checkLinkedIssue(body, labels),
    ...checkProtectedPaths(files, labels),
    ...checkRiskLabel(title, labels, files),
  ];
}

function changedFiles(base, head) {
  const output = execFileSync('git', ['diff', '--name-only', `${base}...${head}`], {
    encoding: 'utf8',
  });
  return output.split('\n').filter(Boolean);
}

function main() {
  const base = process.env.PR_BASE_SHA;
  const head = process.env.PR_HEAD_SHA ?? 'HEAD';
  if (!base) {
    process.stderr.write('PR_BASE_SHA is required\n');
    process.exit(2);
  }
  const problems = evaluatePolicy({
    title: process.env.PR_TITLE ?? '',
    body: process.env.PR_BODY ?? '',
    labels: parseLabels(process.env.PR_LABELS),
    files: changedFiles(base, head),
  });
  if (problems.length === 0) {
    process.stdout.write('PR policy: ok\n');
    return;
  }
  for (const problem of problems) process.stderr.write(`PR policy: ${problem}\n`);
  process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
