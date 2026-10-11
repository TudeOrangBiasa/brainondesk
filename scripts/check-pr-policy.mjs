import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
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

export const LARGE_DIFF_LINES = 400;
export const LARGE_DIFF_FILES = 15;

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

const TEST_FILE =
  /(\.test|\.spec|\.e2e|\.test-helper)\.[cm]?[jt]sx?$|(^|\/)(__fixtures__|fixtures|__snapshots__)\//;

const DOC_FILE = /\.mdx?$/;

const NOT_COUNTED_IN_SIZE = [
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)__snapshots__\//,
  /\.snap$/,
  /(^|\/)(__fixtures__|fixtures)\//,
  /^packages\/app\/src\/locales\//,
  /^THIRD_PARTY_NOTICES\.md$/,
];

export const RISK_RULES = [
  {
    id: 'ci',
    title: 'CI, gates, and repo policy',
    blocksLow: true,
    patterns: [
      /^\.github\/workflows\//,
      /^\.github\/actions\//,
      /^\.github\/CODEOWNERS$/,
      /^scripts\/verify\.sh$/,
      /^scripts\/check-pr-policy(\.test)?\.mjs$/,
      /^\.husky\//,
      /^lint-plugins\//,
      /^(biome\.jsonc|oxlint\.config\.ts|no-comments\.config\.jsonc|knip\.config\.ts)$/,
    ],
  },
  {
    id: 'license',
    title: 'licensing and attribution',
    blocksLow: true,
    patterns: [
      /^LICENSE(\..*)?$/,
      /^LICENSES\//,
      /^NOTICE(\..*)?$/,
      /^THIRD_PARTY_NOTICES\.md$/,
      /(^|\/)(LICENSE|NOTICE)\.upstream$/,
      /(^|\/)UPSTREAM\.md$/,
    ],
  },
  {
    id: 'deps',
    title: 'dependencies and toolchain',
    blocksLow: false,
    patterns: [
      /(^|\/)package\.json$/,
      /^pnpm-lock\.yaml$/,
      /^pnpm-workspace\.yaml$/,
      /^patches\//,
      /^\.node-version$/,
      /^rust-toolchain\.toml$/,
      /(^|\/)Cargo\.(toml|lock)$/,
    ],
  },
  {
    id: 'auth',
    title: 'auth, credentials, and security',
    blocksLow: false,
    patterns: [
      /(^|\/)auth(\/|[-_.])/i,
      /keyring|credential|token-store|secret|oauth|device-flow/i,
      /(^|\/)(csp|permissions?|sandbox)[-_.]/i,
    ],
  },
  {
    id: 'data',
    title: 'stored data shape (config schema, CRDT/Yjs, file writes)',
    blocksLow: false,
    patterns: [
      /^packages\/core\/src\/config\/schema/,
      /(^|\/)(migrations?|schema)[^/]*\.(ts|mjs|json)$/,
      /^packages\/core\/src\/bridge\//,
    ],
  },
  {
    id: 'config',
    title: 'runtime config, packaging, and build',
    blocksLow: false,
    patterns: [
      /(^|\/)\.env(\..*)?$/,
      /^packages\/desktop\/electron-builder[^/]*\.yml$/,
      /^packages\/desktop\/(build|scripts)\//,
      /^packages\/desktop\/electron\.vite\.config\.ts$/,
      /^turbo\.json$/,
      /^tsconfig\.json$/,
    ],
  },
  {
    id: 'contract',
    title: 'public contract (CLI commands, MCP tools, plugin)',
    blocksLow: false,
    patterns: [
      /^packages\/cli\/src\/commands\//,
      /^packages\/server\/src\/mcp\//,
      /^packages\/cli\/src\/mcp\//,
      /^packages\/plugin\//,
    ],
  },
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
    `PR changes protected paths without the "${PROTECTED_PATHS_LABEL}" label (Tude adds it after review): ${shown}${more}`,
  ];
}

function normalizeChanges(files) {
  return files.map((file) => (typeof file === 'string' ? { path: file, lines: 0 } : file));
}

export function suggestRisk({ title = '', files }) {
  const changes = normalizeChanges(files);
  const reasons = [];
  if (title.includes('!:')) {
    reasons.push({ id: 'breaking', title: 'breaking change (!)', blocksLow: true, files: [] });
  }
  for (const rule of RISK_RULES) {
    const matched = changes
      .map((change) => change.path)
      .filter((path) => {
        if (!rule.blocksLow && (TEST_FILE.test(path) || DOC_FILE.test(path))) return false;
        return rule.patterns.some((pattern) => pattern.test(path));
      });
    if (matched.length > 0) {
      reasons.push({ id: rule.id, title: rule.title, blocksLow: rule.blocksLow, files: matched });
    }
  }
  const counted = changes.filter((change) => !NOT_COUNTED_IN_SIZE.some((p) => p.test(change.path)));
  const lines = counted.reduce((sum, change) => sum + change.lines, 0);
  if (lines > LARGE_DIFF_LINES || counted.length > LARGE_DIFF_FILES) {
    reasons.push({
      id: 'size',
      title: `large diff (${lines} lines, ${counted.length} files; limit ${LARGE_DIFF_LINES}/${LARGE_DIFF_FILES})`,
      blocksLow: true,
      files: [],
    });
  }
  return { label: reasons.length > 0 ? RISK_HIGH_LABEL : RISK_LOW_LABEL, reasons };
}

export function checkRiskLabel(title, labels, files) {
  const hasLow = labels.includes(RISK_LOW_LABEL);
  const hasHigh = labels.includes(RISK_HIGH_LABEL);
  const suggestion = suggestRisk({ title, files });
  if (hasLow && hasHigh) {
    return [
      `PR must carry exactly one risk label ("${RISK_LOW_LABEL}" or "${RISK_HIGH_LABEL}"), not both.`,
    ];
  }
  if (!hasLow && !hasHigh) {
    return [
      `PR must carry a risk label. Suggested from changed paths: "${suggestion.label}"${describeReasons(suggestion.reasons)}. Tude merges both; the label only tells him where to spend review time.`,
    ];
  }
  if (hasLow) {
    const blocking = suggestion.reasons.filter((reason) => reason.blocksLow);
    if (blocking.length > 0) {
      return [
        `PR labeled "${RISK_LOW_LABEL}" matches ${blocking.map((r) => r.title).join(', ')}; relabel as "${RISK_HIGH_LABEL}".`,
      ];
    }
  }
  return [];
}

export function riskWarnings(title, labels, files) {
  if (!labels.includes(RISK_LOW_LABEL)) return [];
  return suggestRisk({ title, files })
    .reasons.filter((reason) => !reason.blocksLow)
    .map(
      (reason) =>
        `"${RISK_LOW_LABEL}" but the diff touches ${reason.title}: ${reason.files.slice(0, 5).join(', ')}. Keep low only if the ## Risk paragraph says why no rule applies.`,
    );
}

function describeReasons(reasons) {
  if (reasons.length === 0) return ' (no high-risk rule matched)';
  return ` (${reasons.map((r) => r.title).join('; ')})`;
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

export function parseNumstat(output) {
  return output
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [added, removed, ...rest] = line.split('\t');
      const lines = (Number.parseInt(added, 10) || 0) + (Number.parseInt(removed, 10) || 0);
      return { path: rest.join('\t'), lines };
    });
}

function mergeBase(ref) {
  return execFileSync('git', ['merge-base', ref, 'HEAD'], { encoding: 'utf8' }).trim();
}

function changedFiles(base, head) {
  const output = execFileSync('git', ['diff', '--numstat', '--no-renames', `${base}...${head}`], {
    encoding: 'utf8',
  });
  return parseNumstat(output);
}

export function renderSuggestion(suggestion) {
  const lines = [`Suggested risk label: ${suggestion.label}`];
  for (const reason of suggestion.reasons) {
    const shown = reason.files.slice(0, 5).join(', ');
    const more = reason.files.length > 5 ? ` (+${reason.files.length - 5} more)` : '';
    lines.push(`- ${reason.title}${shown ? `: ${shown}${more}` : ''}`);
  }
  if (suggestion.reasons.length === 0) lines.push('- no high-risk rule matched');
  return `${lines.join('\n')}\n`;
}

function writeSummary(text) {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
}

function main() {
  const suggestOnly = process.argv.includes('--suggest');
  const base = process.env.PR_BASE_SHA ?? (suggestOnly ? mergeBase('origin/main') : undefined);
  const head = process.env.PR_HEAD_SHA ?? 'HEAD';
  if (!base) {
    process.stderr.write('PR_BASE_SHA is required\n');
    process.exit(2);
  }
  const files = changedFiles(base, head);
  const title = process.env.PR_TITLE ?? '';
  const suggestion = suggestRisk({ title, files });
  process.stdout.write(renderSuggestion(suggestion));
  writeSummary(`### Risk\n\n\`\`\`\n${renderSuggestion(suggestion)}\`\`\``);
  if (suggestOnly) return;

  const labels = parseLabels(process.env.PR_LABELS);
  for (const warning of riskWarnings(title, labels, files)) {
    process.stdout.write(`::warning title=PR risk::${warning}\n`);
  }
  const problems = evaluatePolicy({ title, body: process.env.PR_BODY ?? '', labels, files });
  if (problems.length === 0) {
    process.stdout.write('PR policy: ok\n');
    return;
  }
  for (const problem of problems) process.stderr.write(`PR policy: ${problem}\n`);
  writeSummary(`### Policy failures\n\n${problems.map((p) => `- ${p}`).join('\n')}`);
  process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
