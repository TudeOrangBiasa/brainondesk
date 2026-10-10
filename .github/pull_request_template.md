<!-- Judul PR: Conventional Commit, mis. `feat(office): ...`, `fix(core): ...`, `ci: ...` -->

Closes #

## Ringkasan

<!-- Apa yang berubah dan kenapa, 1–3 kalimat. -->

## Bukti verifikasi

<!-- Tempel ringkasan output `pnpm verify` (atau perintah yang dijalankan) dan langkah uji manual. Screenshot untuk perubahan UI. -->

## Checklist

- [ ] Judul PR mengikuti Conventional Commits
- [ ] Body berisi `Closes #N` (atau label `no-issue` kalau memang tanpa issue)
- [ ] `pnpm verify` lulus di lokal
- [ ] Tidak ada komentar kode baru di luar yang diizinkan (lihat AGENTS.md › Comment policy)
- [ ] Tidak mengubah path terlindungi (`.github/workflows/`, `.github/actions/`, `CODEOWNERS`, `LICENSE*`, `NOTICE*`, `THIRD_PARTY_NOTICES.md`, `scripts/verify.sh`, `scripts/check-pr-policy.mjs`) — kalau perlu, minta Tude menambah label `protected-paths-ok`
- [ ] Kode port dari AugmentOffice (Apache-2.0) membawa atribusi sesuai `docs/office/PLAN.md`
- [ ] Dokumen diperbarui kalau perilaku yang terlihat user berubah

<!-- PR dari agent: tetap draft sampai `verify` hijau; jangan merge sendiri. -->
