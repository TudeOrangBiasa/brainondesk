# CI di fork BrainOnDesk

Workflow upstream OpenKnowledge butuh secret, GitHub App, Linear, Vercel, dan akses signing milik Inkeep. Di fork, workflow itu cuma akan gagal atau memanggil layanan Inkeep, jadi sudah dihapus.

## Yang tersisa

- `ci.yml` jalan di setiap PR dan push ke `main`. Isinya:
  - `pnpm install --frozen-lockfile`
  - `lint`
  - `typecheck`
  - unit test `core`

  Tanpa secret.
- `native-config-prebuild.yml` membangun prebuild addon Rust. Hanya jalan kalau `packages/native-config/**` berubah. Tanpa secret.

## Yang dihapus

- Rilis: `release`, `point-release`, `promote-stable`, `select-beta-to-promote`
- Desktop: `desktop-*`, `publish-linux-repo`
- Integrasi: `linear-*`, `monorepo-pr-bridge`, `write-back`, `bug-lane*`
- Lainnya: `share-contract-*`, `stale`

Script pendukung di `.github/scripts/` masih disimpan sebagai referensi. Test bentuknya (`.github/scripts/**/*.test.mjs`) dikeluarkan dari `vitest.scripts.config.ts` karena test itu membaca file workflow yang sudah dihapus.

## Catatan

- Di repo fork, GitHub Actions perlu diaktifkan manual lewat tab Actions.
- Test penuh (`pnpm run test`) tidak dijalankan di CI karena durasinya sekitar 7 menit atau lebih dan sebagian butuh GUI. Jalankan lokal (lihat `docs/office/FEDORA.md`).
- Kegagalan yang sudah ada di `main` (bukan regresi):
  - `scripts/check-override-floors.test.mjs` dan `scripts/check-typescript-resolution.test.mjs`
  - `test-support/setup-files-contract.test.ts`
  - `packages/desktop/tests/smoke/_helpers/dock-state-ready.test.ts`
