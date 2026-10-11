# Testing di BrainOnDesk

Aturan singkat: tes perilaku, bukan implementasi. Tiap PR yang ngubah perilaku bawa tes yang bakal gagal kalau perilakunya rusak, plus bukti verifikasi di body PR.

## Lapisan tes

| Lapisan | Isi | Jalan di mana | Perintah lokal |
| --- | --- | --- | --- |
| Policy | judul PR, `Closes #N`, label risk, protected paths, gitleaks | `verify` (tiap PR) | `pnpm verify`, `pnpm pr:risk` |
| Static | biome, oxlint (+ aturan no-comments), typecheck | `verify` | `pnpm run lint`, `pnpm run typecheck` |
| Unit: core | logika domain, markdown, schema | `verify` | `pnpm exec turbo run test --filter=@inkeep/open-knowledge-core` |
| Unit: app | editor dan UI (Vitest, node) | `verify` | `pnpm exec turbo run test --filter=@inkeep/open-knowledge-app` |
| Unit: desktop | main/preload Electron, config builder | `verify` | `pnpm exec turbo run test --filter=@inkeep/open-knowledge-desktop` |
| Unit: office | `packages/office-*` (docx, pptx, parse, fonts, render) | `verify` | `pnpm exec turbo run test --filter='./packages/office-*'` |
| Build | bundle desktop electron-vite (tanpa packaging) | `verify` | `pnpm exec turbo run build:desktop --filter=@inkeep/open-knowledge-desktop` |
| Slow: server | server kolaborasi lokal, ~15 menit | `slow-tests` | `pnpm exec turbo run test --filter=@inkeep/open-knowledge-server` |
| Slow: CLI | perintah CLI, ~5 menit | `slow-tests` | `pnpm exec turbo run test --filter=@inkeep/open-knowledge` |
| Slow: native-config | crate Rust `toml_edit` (cargo test) | `slow-tests` | `pnpm exec turbo run test --filter=@inkeep/open-knowledge-native-config` |
| Lokal saja | `test:dom`, `test:integration`, `test:e2e`/`test:visual`/`test:a11y` (Playwright), `test:perf`, `test:health`, `test:uncached`, `test:network` | tidak di CI | lihat `scripts` di `package.json` paket terkait |

`pnpm verify` = semua baris `verify` di atas. `pnpm test:slow` = tiga baris slow.

## Kapan tiap lapisan jalan

- **`verify`** (required, ~3 menit): tiap push ke PR dan ke `main`. Ini satu-satunya check yang wajib hijau sebelum merge.
- **`slow-tests`** (tidak required): tiap malam 03:00 WITA di `main`, manual lewat Actions › slow-tests › *Run workflow*, dan otomatis di PR yang nyentuh `packages/server/`, `packages/cli/`, atau `packages/native-config/`. Kalau merah di PR, sebut di body PR: regresi dari PR ini, atau sudah merah di `main`.
- **Lokal saja**: jalanin kalau PR nyentuh area itu (misalnya Playwright untuk perubahan interaksi editor) dan tempel hasilnya di bukti verifikasi. Belum masuk CI karena butuh browser/Electron asli atau makan waktu lama.

## Aturan menulis tes

1. **Tes perilaku, bukan implementasi.** Uji lewat API publik modul: input → output, atau aksi → efek yang kelihatan (file tersimpan, event keluar, UI berubah). Jangan assert urutan panggilan internal, nama fungsi privat, atau isi mock yang cuma nyalin kode.
2. **Bug fix mulai dari tes merah.** Tulis tes yang reproduksi bug, pastikan gagal di `main`, baru fix.
3. **Mock cuma di batas sistem**: jaringan, waktu, filesystem di luar temp dir, proses anak. Kode kita sendiri jangan di-mock.
4. **Deterministik.** Tanpa `sleep` buat nunggu, tanpa jaringan (lihat `test-support/no-net-connect.ts`), pakai temp dir sendiri.
5. **Tes yang baca file di luar paketnya** dinamai `*.uncached.test.*` (aturan cache Turbo, lihat `AGENTS.md`).
6. **Tes yang diharapkan gagal** dipin dengan `expectKnownBug`, jangan di-`skip` diam-diam. Aturannya di `test-support/KNOWN-REDS.md`.
7. **Jangan lemahin gate buat dapet hijau.** Kalau gate salah, betulin gate-nya di PR terpisah dengan alasan.

## Yang wajib ada di PR

- Perubahan perilaku → tes baru atau tes yang diubah, di lapisan paling rendah yang bisa nangkep bug-nya.
- Bagian **Bukti verifikasi**: perintah yang beneran dijalanin + hasilnya (minimal `pnpm verify`), plus langkah uji manual atau screenshot untuk UI.
- Kalau tes gak masuk akal (docs, copy, config), tulis alasannya di bukti verifikasi.

## Kegagalan yang sudah ada di `main`

Bukan regresi dan bukan bagian gate: `scripts/check-override-floors.test.mjs`, `scripts/check-typescript-resolution.test.mjs`, `test-support/setup-files-contract.test.ts`, `packages/desktop/tests/smoke/_helpers/dock-state-ready.test.ts`. Tes PowerShell di `packages/core/src/handoff/terminal-launch.test.ts` wajib `pwsh` kalau `CI=true` (runner GitHub punya). Dua tes CLI `the npx fallback runs with this chain's channel` cuma gagal di mesin yang `npx`-nya beda lokasi; di CI lulus. Kalau kamu betulin salah satunya, hapus dari daftar ini.
