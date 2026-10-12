# Contributing to BrainOnDesk

BrainOnDesk is a GPL fork of [OpenKnowledge](https://github.com/inkeep/open-knowledge). Open issues and PRs in this repo. Tude reviews and merges every PR.

## PR rules

1. **One PR, one thing.** Small enough to review in one sitting. Split big work into stacked PRs (each child targets its parent's branch).
2. **Draft first.** Agents always use `gh pr create --draft`. Agents never mark ready, merge, or enable auto-merge. Tude merges, including `risk:low`.
3. **Conventional Commits title**: `type(scope): subject`, for example `fix(office): re-store etag after save`. Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`. Add `!` for breaking changes.
4. **Link the issue**: `Closes #N` in the body. No issue? Use the `no-issue` label and explain why.
5. **One risk label**, `risk:low` or `risk:high`. Check the automatic suggestion with `pnpm pr:risk` (after committing). The rules follow `whips/RISK.md`:
   - `risk:low` is **rejected by CI** if the PR touches CI/gate/lint config, licensing/attribution, has a breaking title, or the diff is > 400 lines / > 15 files (lockfiles, locales, snapshots, fixtures don't count).
   - **Warning** (may stay low if `## Risk` explains why): auth/credentials/keyring, config schema or CRDT bridge, packaging/env, CLI commands, MCP tools, plugin, dependencies.
6. **Protected paths** (`.github/workflows/`, `.github/actions/`, `CODEOWNERS`, `LICENSE*`, `NOTICE*`, `*.upstream`, `THIRD_PARTY_NOTICES.md`, `scripts/verify.sh`, `scripts/check-pr-policy.mjs`) need the `protected-paths-ok` label. Only Tude adds it, after review.
7. **`verify` must be green.** Run `pnpm verify` locally first. Never weaken a gate to get green.
8. **Tests + evidence.** Behavior changes must ship with tests, and the PR body must include verification evidence (commands + results). Details in [docs/TESTING.md](./docs/TESTING.md).
9. **PR body** follows the [template](./.github/pull_request_template.md): Summary, Verification evidence, `## Risk` (max 3 sentences), `## Why this approach` (2–4 casual sentences: the main decision, the alternative, why it lost).
10. **No code comments** outside the allowlist (see [Code comments](#code-comments)), no secrets/personal data/local paths, commit `pnpm-lock.yaml` when dependencies change, and run `pnpm run notices` when third-party packages change.
11. **Code ported from GenOffice** (Apache-2.0) carries attribution per [docs/office/LICENSING.md](./docs/office/LICENSING.md).

No changesets: this fork has no npm/desktop release pipeline yet, and the upstream changeset tooling has been removed. Describe user-visible changes in the PR body.

## Development setup

A fresh clone builds and tests with no environment variables:

```bash
corepack enable pnpm  # make the pnpm commands below use the packageManager pin
pnpm install
pnpm verify           # the same gate CI runs on every PR
```

Run the editor app (http://localhost:5173):

```bash
cd packages/app && pnpm run dev
```

Run the docs site:

```bash
cd docs && pnpm run dev
```

See `.env.example` for optional settings (OpenTelemetry, a custom dev port).

### Toolchain

The repo pins **Node.js 24.21.0** in `.node-version` and in `package.json`'s `devEngines.runtime`, and the `packageManager` field selects the exact **pnpm 12** version. `pnpm install` downloads that Node.js into the pnpm store the first time, from the per-platform archives `pnpm-lock.yaml` pins by checksum, so the first install needs network access. After that, every command started through `pnpm run`, `pnpm exec` or a package script runs on it, whichever `node` is on your `PATH`, and `engineStrict` in `pnpm-workspace.yaml` checks the `engines.node` range against it. Keep the two pins equal, and run `pnpm install` after changing them so the commands, and the Turbo cache key the install writes, pick up the new version. Corepack and npm both need a Node.js to provide pnpm, so install the `.node-version` release first with your Node version manager (for example `fnm install`), then run `corepack enable pnpm` once so the `pnpm` commands below use Corepack's shim, or install pnpm 12 with `npm install -g pnpm@12`. The standalone installer from [pnpm.io/installation](https://pnpm.io/installation) needs no Node.js. A pnpm 10 on your `PATH` cannot switch itself to pnpm 12, so upgrade it or use Corepack. For a script you start with `node` directly, select `.node-version` first with your Node version manager, for example `fnm use`.

Rust is pinned to one exact release. `rust-toolchain.toml` at the repo root declares it, and rustup applies it to every `cargo` and `rustc` call inside the repository and installs that release on the first build, so that build needs network access once. Install rustup from [rustup.rs](https://rustup.rs). The native-config package's build script refuses any other compiler: a `RUSTUP_TOOLCHAIN` variable, a `+toolchain` argument, a `rustup override` set on the directory, or a `cargo` or `rustc` earlier on your `PATH` that rustup does not manage (a Homebrew, distribution or Nix install, for example). Its error names the compiler it found and the release the file declares.

TypeScript is pinned twice on purpose. `@typescript/native` is this repo's alias for `typescript@~7.0.2`, the Go compiler the gates run; it owns the `tsc` binary, so `node_modules/.bin/tsc --version` at the root reports 7. The root's own `typescript` stays on `~6.0.3` only to supply tsserver to your editor, because TypeScript 7 ships none — that is an API resolution, not the compiler. The split means 7.0-only lib typings or an unchecked side-effect import can red a gate your editor calls clean. Open your editor at the repo root, not inside a package, or its language server falls back to a machine-global TypeScript. Any package that runs `tsc` in a script declares `"typescript": "~7.0.2"` of its own; `node scripts/check-typescript-resolution.mjs`, which `pnpm run check:drift:guards` runs, enforces the *resolved* 7.0 line rather than the declared range; the range is a tilde for that reason, because a caret installs clean today and reds once 7.1 ships. Its errors say why.

The base `tsconfig.json` carries three settings that red a first build. `erasableSyntaxOnly: true` makes constructor parameter properties (`constructor(private foo: string)`) an error; write the assignment out. `verbatimModuleSyntax: true` makes a plain `import { SomeType }` an error; write `import type`. `types: []` turns off automatic `@types/*` inclusion, so a package that uses Node globals lists `"types": ["node"]` in its own `tsconfig.json` and `@types/node` in its own `package.json`.

Patched dependencies (listed under `patchedDependencies` in `pnpm-workspace.yaml`, with the diffs in `patches/`) are authored with pnpm: run `pnpm patch <name>@<version>`, edit the printed temp directory, then `pnpm patch-commit <temp-dir>` to write the patch file and register it. A patch that fails to apply fails the install closed — it is never silently skipped.

### Spelling-language combobox

The spelling-language picker uses [shadcn Combobox multiple-selection chips](https://ui.shadcn.com/docs/components/radix/combobox#multiple-selection), backed by Base UI because [Radix Primitives does not provide a Combobox primitive](https://github.com/radix-ui/primitives/issues/3549#issuecomment-2895211522). Other controls, including the surrounding Settings dialog, remain Radix. Keep the popup portal inside that dialog's focus boundary and scope Escape interception to the open spelling combobox, not cmdk Settings search. The combobox inherits reduced-motion styling at the primitive level.

With the installed Base UI version, ArrowLeft from the empty search input moves focus onto a chip and closes the popup. Escape then dismisses Settings because no popup remains open. Keep this distinct from Escape in the expanded input, which closes only the popup first.

The four Floating UI overrides in `pnpm-workspace.yaml` satisfy Base UI's direct and transitive dependency floors, rather than the historical Radix dependency freeze. They are shared with Radix positioning and editor suggestion popups. Changes need regression coverage of Settings, ShareBranchSwitchDialog and CreateProjectDialog, not just the language picker. Keyboard selection/removal, popup-first Escape dismissal, empty search and reduced-motion styling have DOM coverage beside the components.

## Common commands

```bash
pnpm run format       # format (Biome)
pnpm run lint         # lint (Biome)
pnpm run typecheck    # TypeScript
pnpm run test         # tests
pnpm run build        # build all packages
pnpm verify           # the PR gate (see docs/TESTING.md)
pnpm test:slow        # server, CLI and native-config tests (nightly in CI)
pnpm run check:drift:guards  # generated-artifact freshness, i18n, toolchain pins (not part of `check`)
```

Run a single package's scripts from its directory, e.g. `cd packages/app && pnpm run test`.

## Code comments

This repo does not use code comments, and `pnpm run lint` enforces that. It inverts the usual open-source norm, so it catches most first-time contributors by surprise — it is deliberate, not an oversight. Put the explanation in a name, a type, a test, your commit message, or the PR body instead.

A short allowlist survives: directives a tool parses (`biome-ignore lint/style/noVar: reason`, `@ts-expect-error the fixture is deliberately malformed`, `@vitest-environment jsdom`, `/// <reference types="vite/client" />`, `SPDX-License-Identifier: GPL-3.0-or-later`), JSDoc carrying `@deprecated` (the audit-tag class is empty in this repo and admits nothing), and comments that BEGIN with a contract marker — `STOP: a cross-file contract a reader must not break`, `WARN: a sibling that silently drifts if this changes`, or `UPSTREAM(electron/electron#19920): a code shape forced on us from outside this repo`.

If lint stops you, the diagnostic names the class of comment, the fix, and links to [`lint-plugins/no-comments/README.md`](./lint-plugins/no-comments/README.md) — the full policy, including how to convert a comment worth keeping into one of the allowed forms. Deleting it is usually the right answer.

## License

By contributing, you agree that your work is licensed under the [GNU General Public License v3.0 or later](./LICENSE) (`GPL-3.0-or-later`), the same license as OpenKnowledge and BrainOnDesk.
