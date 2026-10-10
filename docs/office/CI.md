# CI dan gerbang verifikasi BrainOnDesk

Workflow upstream OpenKnowledge butuh secret, GitHub App, Linear, Vercel, dan signing milik Inkeep. Di fork ini semuanya sudah dihapus. Yang tersisa satu workflow, `verify`, yang jalan di runner GitHub-hosted, tanpa secret, dengan token read-only.

## Workflow `verify` (`.github/workflows/verify.yml`)

Jalan di setiap PR (termasuk saat judul/body/label diubah), push ke `main`, dan manual. Push baru ke PR yang sama membatalkan run lama (`cancel-in-progress`).

| Job | Isi | Kapan |
| --- | --- | --- |
| `policy` | judul Conventional Commit, `Closes #N` di body, path terlindungi, gitleaks atas commit PR | hanya PR |
| `lint, typecheck, build` | `pnpm run lint` (biome + oxlint + aturan no-comments), `pnpm run typecheck`, `turbo run build:desktop` untuk desktop, test script policy | selalu |
| `test (core/app/desktop)` | unit test per paket via turbo, paralel | selalu |
| `verify` | agregator: hijau hanya kalau semua job di atas sukses (`policy` boleh skip di push) | selalu |

Branch protection cukup mewajibkan satu check: **`verify`**. Nama job ini jangan diubah.

Cache: store pnpm (kunci `pnpm-lock.yaml`) dan `.turbo/cache` per job (kunci commit, restore dari run sebelumnya). Paket yang tidak berubah jadi cache hit, jadi run berikutnya jauh lebih cepat dari run pertama.

### Kenapa build-nya `build:desktop`, bukan `build:dir`

`build:desktop` (electron-vite) sudah mengompilasi main, preload, dan renderer, dan lewat dependensi turbo ikut membangun core, server, app, CLI, dan addon Rust native-config. Itu menangkap hampir semua error build. `build:dir` menambah download binary Electron, rebuild modul native, dan packaging electron-builder: beberapa menit ekstra tanpa banyak sinyal tambahan untuk PR. Packaging dicek saat rilis (tiket fase 6).

### Kenapa test-nya hanya core, app, desktop

Test `server` (>15 menit) dan `cli` (~6 menit, dua test bergantung pada lokasi `npx` di mesin) membuat gerbang lewat dari 15 menit. Jalankan `pnpm run check` di lokal kalau mengubah server atau CLI. Test DOM, integrasi, e2e, dan perf juga tidak masuk gerbang.

## Aturan PR (`scripts/check-pr-policy.mjs`)

- Judul: `<type>(<scope>)!: <ringkasan>`, type salah satu `feat fix docs style refactor perf test build ci chore revert`, scope huruf kecil.
- Body: `Closes #N` / `Fixes #N` / `Resolves #N`. Label `no-issue` untuk PR tanpa issue.
- Path terlindungi butuh label `protected-paths-ok`: `.github/workflows/`, `.github/actions/`, `.github/CODEOWNERS`, `LICENSE*`, `LICENSES/`, `NOTICE*`, `LICENSE.upstream`/`NOTICE.upstream`, `THIRD_PARTY_NOTICES.md`, `scripts/verify.sh`, `scripts/check-pr-policy.mjs`. Label ini ditambahkan Tude setelah review, bukan oleh agent. Label hanya polisi tidur; perlindungan sebenarnya adalah CODEOWNERS + wajib review.
- Secret: gitleaks `8.30.1` (checksum diverifikasi) memindai commit `base..head` PR.

## Lokal: `pnpm verify`

`scripts/verify.sh` menjalankan urutan yang sama dengan CI: install frozen, policy (pakai `gh pr view` kalau PR sudah ada, kalau belum hanya menampilkan path terlindungi yang tersentuh), gitleaks (kalau terpasang, `sudo dnf install gitleaks`), lint, typecheck, unit test core/app/desktop, build desktop. `VERIFY_SKIP_INSTALL=1` melewati install, `VERIFY_BASE` mengganti base (default `origin/main`).

## Yang dihapus dari upstream

- Workflow rilis: `release`, `point-release`, `promote-stable`, `select-beta-to-promote`
- Desktop: `desktop-*`, `publish-linux-repo`, `native-config-prebuild` (matriks macOS/Windows untuk publish CLI ke npm)
- Integrasi Inkeep: `linear-*`, `monorepo-pr-bridge`, `write-back`, `bug-lane*`, `share-contract-*` beserta composite action-nya, `stale`
- `CLA.md` (CLA ke Inkeep tidak berlaku di fork)
- Link Discord/openknowledge.ai/advisory Inkeep di issue template, `SECURITY.md`, `CONTRIBUTING.md` diarahkan ke repo ini

Script pendukung di `.github/scripts/` masih disimpan karena `packages/desktop/tests/unit/packaged-report-path.uncached.test.mjs` mengimpor salah satunya. Test bentuknya dikeluarkan dari `vitest.scripts.config.ts` karena membaca workflow yang sudah dihapus.

## Catatan

- Kegagalan yang sudah ada di `main` (bukan regresi, tidak masuk gerbang): `scripts/check-override-floors.test.mjs`, `scripts/check-typescript-resolution.test.mjs`, `test-support/setup-files-contract.test.ts`, `packages/desktop/tests/smoke/_helpers/dock-state-ready.test.ts`.
- Pengecualian lint untuk paket port `packages/office-*` (biome/oxlint/no-comments/knip) dibawa oleh PR engine office (#34) bersama kodenya, supaya tidak konflik.
