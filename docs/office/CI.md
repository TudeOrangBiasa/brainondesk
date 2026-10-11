# CI BrainOnDesk

Dua workflow, semuanya runner GitHub-hosted, token read-only, tanpa secret, action dipin ke SHA. Aturan PR ada di [CONTRIBUTING.md](../../CONTRIBUTING.md), lapisan tes di [docs/TESTING.md](../TESTING.md).

## `verify` (required)

Jalan di tiap PR (termasuk saat judul/body/label diubah), push ke `main`, dan manual. Push baru membatalkan run lama di PR yang sama.

| Job | Isi | Kapan |
| --- | --- | --- |
| `policy` | `scripts/check-pr-policy.mjs`: judul, `Closes #N`/`no-issue`, label risk + saran dari path, protected paths; gitleaks atas commit PR | PR saja |
| `lint, typecheck, build` | biome + oxlint (+ no-comments), typecheck, `build:desktop` (electron-vite), tes policy | selalu |
| `test (core/app/desktop/office)` | unit test per grup via turbo, paralel | selalu |
| `verify` | agregator: hijau cuma kalau semua job di atas sukses (`policy` boleh skip di push) | selalu |

Branch protection cukup wajibkan **`verify`**. Jangan ganti nama job ini.

Setup bersama ada di `.github/actions/setup` (Node dari `.node-version`, pnpm lewat corepack, cache pnpm store + `.turbo/cache`, toolchain Rust dari `rust-toolchain.toml`, install frozen). Ini buatan kita, bukan sisa upstream.

`build:desktop` dipilih ketimbang `build:dir`: sudah ngompilasi main/preload/renderer dan, lewat dependensi turbo, core/server/app/CLI/native-config. `build:dir` cuma nambah download Electron + packaging, beberapa menit tanpa sinyal tambahan.

## `slow-tests` (tidak required)

Server (~15 menit), CLI (~5 menit), native-config (cargo). Jalan tiap malam 19:00 UTC (03:00 WITA) di `main`, manual lewat *Run workflow*, dan di PR yang nyentuh `packages/server/`, `packages/cli/`, `packages/native-config/`. Kegagalan nightly dikirim GitHub ke email Tude.

## Risk label

`policy` nyaranin label dari diff dan nulis alasannya di job summary. Aturan dipetain dari `whips/RISK.md` (skills-for-agents) ke path repo ini, isinya di `RISK_RULES` di `scripts/check-pr-policy.mjs`. Aturan keras (CI/gate, lisensi, breaking, diff besar) nolak `risk:low`; aturan lunak cuma warning. Label `risk:*` cuma nunjukin di mana Tude perlu fokus review. Merge tetap Tude.

## Lokal

- `pnpm verify`: urutan yang sama dengan `verify`. Kalau PR belum ada, policy cuma nampilin saran risk. `VERIFY_SKIP_INSTALL=1` lewatin install, `VERIFY_BASE` ganti base (default `origin/main`).
- `pnpm pr:risk`: saran label risk buat commit di branch ini.
- `pnpm test:slow`: tiga paket slow.

## Yang dihapus dari upstream

- Workflow rilis/desktop/npm: `release`, `point-release`, `promote-stable`, `select-beta-to-promote`, `desktop-*`, `publish-linux-repo`, `native-config-prebuild`.
- Integrasi Inkeep: `linear-*`, `monorepo-pr-bridge`, `write-back`, `bug-lane*`, `share-contract-*` + composite action-nya, `stale`, `CLA.md`.
- `.github/scripts/` (88 file helper untuk workflow di atas) dan tes path report DMG macOS yang mengimpornya.

Masih ada, belum dipakai CI: tooling changeset (`.changeset/`, `pnpm changeset`), skrip rilis di `scripts/` (`compute-*-version`, `aggregate-stable-changelog`, `build-slack-release-payload`, `render-release-downloads`, `linux-repo/`, `verify-*-in-packaged-dmg`), `check:drift`, `tier1–3`, `knip`. Kandidat dihapus di PR terpisah.
