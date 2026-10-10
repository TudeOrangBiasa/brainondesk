# Lisensi dan atribusi (BrainOnDesk)

## Ringkas
- **Proyek ini:** GPL-3.0-or-later (`LICENSE`), sebagai fork OpenKnowledge.
- **Kode yang di-port dari AugmentOffice/GenOffice:** tetap Apache-2.0 per file. Apache-2.0 kompatibel satu arah dengan GPLv3, jadi boleh digabung, dan hasil gabungannya didistribusikan sebagai GPLv3.
- **Atribusi:** `NOTICE` di root wajib ikut setiap distribusi. Teks lisensi tambahan ada di `LICENSES/` (`Apache-2.0.txt`, `Unicode-3.0.txt`). Keduanya ikut dipaketkan ke aplikasi lewat `extraResources` di `packages/desktop/electron-builder.yml`.
- **Jangan port** folder `ee/` dari AugmentOffice/GenOffice, karena berlisensi Enterprise dan bukan open source.
- **CLA Inkeep (`CLA.md`)** hanya berlaku untuk PR ke `inkeep/open-knowledge`. Fork ini tidak mengirim PR ke upstream, jadi CLA tidak relevan di sini.

## Aturan untuk file hasil port
1. **Lokasi:** taruh di paket `packages/office-*` (lihat `PLAN.md`), jangan dicampur ke paket OK yang sudah ada.
2. **Baris pertama setiap file `.ts/.tsx/.mjs`** wajib berisi:
   ```ts
   // SPDX-License-Identifier: Apache-2.0
   ```
   Bentuk ini diizinkan oleh lint no-comments (`lint-plugins/no-comments/allowlist.mjs`).
3. **Setiap paket port wajib punya `UPSTREAM.md`** berisi:
   - repo dan commit sumber, misalnya `TudeOrangBiasa/augmentoffice@39a32863`
   - daftar path asal → path baru
   - ringkasan perubahan. Ini memenuhi kewajiban Apache-2.0 §4(b) untuk menandai file yang diubah.
4. **Komentar asli dari upstream boleh dipertahankan.** Tiket #10 akan mengecualikan `packages/office-*/**` dari aturan no-comments supaya diff terhadap AugmentOffice tetap kecil dan mudah di-sync.
5. **Font dan aset** yang ikut di-port (misalnya `apps/docs/src/renderer/fonts`) lisensinya dicatat di `UPSTREAM.md` paketnya dan di `THIRD_PARTY_NOTICES.md` (lewat `pnpm run notices`, atau bagian manual kalau generator tidak menangkapnya).
6. **Kalau file berasal dari `radicals.ts`** (data Unicode), sebutkan di `UPSTREAM.md`. Atribusi Unicode-nya sudah ada di `NOTICE`.

## Kode baru
Kode baru yang ditulis untuk BrainOnDesk berlisensi GPL-3.0-or-later dan tidak perlu header, mengikuti konvensi OK.
