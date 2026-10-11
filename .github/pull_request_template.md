<!-- Judul: Conventional Commits, `type(scope): subjek` (feat, fix, docs, refactor, test, chore, perf, ci, build, style, revert). Aturan lengkap: CONTRIBUTING.md -->

Closes #

## Ringkasan

<!-- Apa yang berubah dan kenapa, 1–3 kalimat. Tambah **Scope:** kalau ada yang sengaja ditinggal. -->

## Bukti verifikasi

<!-- Tiap perintah yang beneran dijalanin + hasilnya. Minimal `pnpm verify`. UI: screenshot atau langkah manual. Tanpa tes? Tulis alasannya. Lihat docs/TESTING.md. -->

- `pnpm verify`:

## Risk

<!-- Label `risk:low` atau `risk:high`, cek `pnpm pr:risk`. Maks 3 kalimat. High: aturan yang kena, file-nya, dan satu hal yang harus dicek reviewer. Low: apa yang disentuh dan kenapa gak ada aturan yang kena. -->

## Kenapa begini

<!-- 2–4 kalimat santai: keputusan utama, alternatifnya, kenapa alternatif itu kalah. -->

## Checklist

- [ ] Tes untuk perubahan perilaku (atau alasan kenapa gak perlu)
- [ ] `pnpm verify` lulus di lokal
- [ ] Tanpa komentar kode di luar allowlist, tanpa secret atau path lokal
- [ ] Docs diupdate kalau perilaku yang kelihatan user berubah
- [ ] Kode port GenOffice bawa atribusi (`docs/office/LICENSING.md`)

<!-- Agent: buka sebagai draft, jangan mark ready, jangan merge. Tude yang merge semua PR. Label `protected-paths-ok` cuma dipasang Tude. -->
