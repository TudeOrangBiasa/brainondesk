<!-- Judul PR: Conventional Commit, mis. `feat(office): ...`, `fix(core): ...`, `ci: ...` -->

Closes #

## Ringkasan

<!-- Apa yang berubah dan kenapa, 1–3 kalimat. -->

## Bukti verifikasi

<!-- Tempel ringkasan output `pnpm verify` (atau perintah yang dijalankan) dan langkah uji manual. Screenshot untuk perubahan UI. -->

## Checklist

- [ ] Judul PR mengikuti Conventional Commits
- [ ] Body berisi `Closes #N` (atau label `no-issue` kalau memang tanpa issue)
- [ ] Label risiko: tepat satu, `risk:low` atau `risk:high` (label hanya membaca blast radius diff dan mengatur verifikasi otomatis — bukan siapa yang boleh merge)
- [ ] `risk:high` wajib kalau sentuh path terlindungi atau breaking change (`!`) — label `risk:low` di PR seperti itu ditolak policy
- [ ] `pnpm verify` lulus di lokal
- [ ] Tidak ada komentar kode baru di luar yang diizinkan (lihat AGENTS.md › Comment policy)
- [ ] Tidak mengubah path terlindungi (`.github/workflows/`, `.github/actions/`, `CODEOWNERS`, `LICENSE*`, `NOTICE*`, `THIRD_PARTY_NOTICES.md`, `scripts/verify.sh`, `scripts/check-pr-policy.mjs`) — kalau perlu, pasang label `protected-paths-ok` sendiri setelah cek otomatis lolos
- [ ] Kode port dari GenOffice (Apache-2.0) membawa atribusi sesuai `docs/office/LICENSING.md`
- [ ] Dokumen diperbarui kalau perilaku yang terlihat user berubah

<!-- PR dari agent: buka sebagai ready. Merge semua tier setelah `verify` hijau di head + verdict independen PASS di head yang sama + 0 thread `fix` + mergeable + sesuai ticket; CI merah = fix sampai hijau, jangan lemahkan gerbang. -->
