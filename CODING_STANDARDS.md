# Coding Standards

## Naming

Names carry the explanation — no code comments to fall back on. Domain terms follow the relevant `GLOSSARY.md` (see `GLOSSARY-MAP.md`); use the glossary term, never a synonym it avoids. Test names describe behavior, not wiring.

## Module shape

One behavior per module behind a small interface. Shared contracts between packages live in `packages/core`; the app, server, and desktop consume them, never duplicate them. Keep editor cores (TipTap/ProseMirror graph, CodeMirror view/state) on their pinned versions in `pnpm-workspace.yaml` — upgrades are deliberate, separately tested changes.

## TypeScript

- `import type` for type-only imports (`verbatimModuleSyntax`).
- No constructor parameter properties — write the assignment out (`erasableSyntaxOnly`).
- Packages using Node globals list `"types": ["node"]` in their own `tsconfig.json` and `@types/node` in their own `package.json`.
- UI code uses the `use()` hook, not `useContext`; no manual `useCallback`/`useMemo`/`memo` (React Compiler memoizes). Biome enforces both.

## Test seams

Guard behavior with tests, not comments. Regression coverage is required for: Floating UI positioning (Settings, ShareBranchSwitchDialog, CreateProjectDialog), settings search + combobox keyboard/Escape/reduced-motion, CSS token cascades in `globals.css` (side-by-side `globals.*.test.ts`), and server share-v2 smoke. Permanent tests assert consumer-visible behavior; throwaway scripts prove the rest.

## What review checks

`pnpm verify` green, focused diff, no new code comments outside the AGENTS.md allowlist, changeset for behavior changes (pre-1.0 shift-down: breaking rides as `minor`, never `major`), `pnpm-lock.yaml` committed with dependency changes, `pnpm run notices` when third-party packages change.

## Commit message format

Conventional Commits: `<type>(<scope>): <summary>`, types `feat fix docs style refactor perf test build ci chore revert`, scope lowercase. Breaking changes add `!`. PR titles follow the same shape and carry `Closes #N`; PR bodies follow the `pr` skill shape.
