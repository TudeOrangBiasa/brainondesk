# Rencana: Editor Office di OpenKnowledge (fork)

Status: draft. Dokumen ini hanya rencana dan belum ada kode yang di-port.
Tiket dan milestone ada di Issues fork ini, dengan epic sebagai pelacak utama.

## 1. Tujuan

Fork ini memakai OpenKnowledge (OK) sebagai fondasi: UI, file tree, tab, dan mesin ACP-nya, sehingga agen seperti OpenCode, Pi, Gemini, Antigravity, Claude, dan Codex sudah langsung bisa dipakai.

Di atasnya ditambahkan editor office dari [AugmentOffice](https://github.com/TudeOrangBiasa/augmentoffice), sebuah fork dari genspark-ai/genoffice:

- **Docs** (`.docx`): TipTap + `docx-engine`
- **Sheets** (`.xlsx`): Univer + sidecar Rust `xlsx-engine`
- **Slides** (`.pptx`): Konva + `pptx-engine`/`pptx-render`
- **PDF** (opsional): pdfjs + pdfium + pdf-lib

Batasan cakupan:

- **Hanya desktop (Electron), Linux/Fedora dulu.** Web UI, `ok start`, dan npm CLI boleh rusak untuk tipe office.
- **Tanpa server atau cloud.** Server lokal bawaan OK (Hocuspocus + API di loopback) tetap dipakai karena itu bagian inti aplikasi. Fitur yang butuh internet (share link openknowledge.ai, subscribe, skills.sh) dimatikan atau disembunyikan. Backend cloud masuk tahap berikutnya dan di luar cakupan.
- Agen bisa membaca dan mengedit dokumen office lewat tool MCP yang diberikan OK ke sesi ACP.

## 2. Lisensi

- **OK berlisensi GPL-3.0-or-later**, jadi seluruh fork ini juga GPL-3.0-or-later.
- **AugmentOffice/GenOffice berlisensi Apache-2.0.**
  - Apache-2.0 kompatibel satu arah ke GPLv3. Kode Apache boleh digabung ke proyek GPLv3, dan hasil gabungannya didistribusikan sebagai GPLv3.
  - Kewajiban Apache-2.0 tetap berlaku untuk file yang di-port:
    - Pertahankan header copyright yang ada.
    - Beri tanda pada file yang diubah ("modified by …").
    - Sertakan teks lisensi Apache-2.0.
    - Teruskan isi `NOTICE` GenOffice (Copyright 2026 Mainfunc, Inc.) beserta atribusi Unicode untuk `radicals.ts`.
  - Rencana pelaksanaannya:
    - Buat `NOTICE` di root.
    - Simpan `LICENSES/Apache-2.0.txt`.
    - Tambahkan header `SPDX-License-Identifier: Apache-2.0` dan baris "Copyright Mainfunc, Inc." di file hasil port. Komentar SPDX memang diizinkan oleh lint no-comments OK.
    - Tambahkan bagian GenOffice ke `THIRD_PARTY_NOTICES.md` (lewat `pnpm run notices` atau bagian manual).
- **Folder `ee/` di AugmentOffice (Enterprise License) jangan disentuh atau di-port.**
- **CLA Inkeep hanya berlaku kalau kita mengirim PR ke upstream `inkeep/open-knowledge`.** Fork ini tidak mengirim apa pun ke upstream.
- **Merek:** "OpenKnowledge" dan logonya milik Inkeep. Untuk rilis publik, sebaiknya rebrand (lihat tiket rebrand).
- **Font:** font bawaan di `apps/docs/src/renderer/fonts` punya lisensi masing-masing (lihat README-nya). Ikutkan ke notices.

## 3. Arsitektur

### 3.1 Cara OK menangani tipe dokumen sekarang

- **Daftar ekstensi dan deteksi tipe:**
  - `packages/core/src/constants/upload.ts`: `isExcalidrawDocFile`, `isMermaidDocFile`, `SIDEBAR_*_EXTENSIONS`. `docx/xlsx/pptx` saat ini hanya dianggap *asset* yang bisa diunduh.
  - `packages/server/src/doc-extensions.ts`: hanya mengenal `.md`/`.mdx` sebagai dokumen CRDT.
- **Routing editor:**
  - `packages/app/src/components/EditorActivityPool.tsx`: `lazy()` per tipe, yaitu Mermaid, Excalidraw, TextDoc, dan Tiptap.
  - `packages/app/src/components/EditorArea.tsx`: tab `kind === 'asset'` diarahkan ke `AssetPreview`.
  - `packages/app/src/editor/editor-tabs.ts`: id tab (`\0asset:` dan doc).
  - `packages/app/src/editor/asset-dispatch/registry.ts`: `AssetViewerRegistry` (ext → viewer).
- **File tree:** `packages/app/src/components/file-tree-adapter.ts`, `file-entry-icon.tsx`, `navigation-targets.ts`.
- **Contoh pola:** Excalidraw. Disimpan sebagai `Y.Text('source')` di Hocuspocus, lalu dipersist sebagai teks. Pola ini **tidak cocok** untuk OOXML biner.
- **ACP:** `packages/server/src/acp/thread-manager.ts` memberikan MCP server OK (`/mcp`, http atau stdio) ke setiap sesi. Tool-nya didaftarkan di `packages/server/src/mcp/tools/index.ts` (`registerAllTools`) dan dijalankan di **server (Node)**.

### 3.2 Desain tipe dokumen office

1. **Registry tipe dokumen bersama** (`packages/core/src/office/doc-types.ts`)
   - Isi: `{ id: 'docx'|'xlsx'|'pptx'|'pdf', exts, icon, editor: lazy import, mcpToolset }`.
   - Satu sumber ini dipakai oleh file tree, routing tab, "New file", dan MCP. Fungsi `isOfficeDocFile()` dipakai di semua tempat yang sekarang memanggil `isExcalidrawDocFile`.
2. **File biner tidak lewat CRDT.**
   - Office dibuka sebagai tab jenis baru (`kind: 'office'`), tidak lewat Hocuspocus.
   - Load: bytes dibaca lewat endpoint lokal server (`GET /api/office/file?path=`, diperluas dari `asset-serve-middleware`).
   - Save: `PUT /api/office/file` dengan atomic write, cek hash/mtime (deteksi konflik), dan dibatasi ke root proyek.
   - Untuk xlsx, sidecar Rust dijalankan oleh **server Node**. Sidecar ini menangani streaming range dan surgical save, sama seperti di `sheets-main.ts`.
   - Perubahan file dari luar (misalnya agen menulis langsung) dideteksi lewat `file-watcher.ts` yang sudah ada. Kalau editor tidak dirty, editor otomatis reload. Kalau dirty, muncul prompt.
3. **Editor = paket renderer hasil port**
   - Paket: `packages/office-docs`, `office-sheets`, `office-slides`, `office-pdf` (React 19, satu-satunya entry adalah komponen `<XEditor path bytes onSave />`).
   - Engine dipindah utuh sebagai paket: `packages/office-docx-engine`, `office-pptx-engine`, `office-pptx-render`, `office-file-parse`, `office-font-metrics`. Engine docx dan pptx murni TypeScript (jszip + fast-xml-parser), jadi bisa dipakai di renderer maupun di Node.
   - IPC Electron di AugmentOffice (`apps/*/src/main/*-main.ts`, `preload`) diganti dengan adapter `OfficeHost` yang memakai HTTP/WS server OK.
   - Shell ribbon/menu dari AugmentOffice dibawa sebagai toolbar di dalam tab. Shell tab WPS (`apps/shell`) **tidak** di-port karena OK sudah punya tab sendiri.
4. **Agen bisa menyentuh dokumen office (MCP)**
   - Tool dibagi per tipe dan didaftarkan di `registerAllTools`:
     - `docx_*`: `get_document_context`, `read_blocks`, `replace_blocks`, `insert_content`, `apply_commands`
     - `xlsx_*`: `get_workbook_context`, `read_range`, `propose_operations`, dll
     - `pptx_*`: `get_deck_context`, `read_slide`, `add_slide`, `set_element_text`, dll
   - Skema tool diambil dari `apps/*/src/renderer/ai/tools.ts` di AugmentOffice.
   - **Eksekusi lewat jalur relay ke renderer (utama):**
     - Tool di AugmentOffice bekerja langsung pada editor yang sedang hidup (TipTap `Editor`/transaksi ProseMirror, model Univer, scene Konva).
     - Jadi server meneruskan pemanggilan tool lewat WebSocket ke tab yang membuka file tersebut. Tab itu menjalankan `AgentSkill.executeTool()` dan mengembalikan hasilnya.
     - Undo, render, dan indikator dirty tetap berjalan normal.
     - Kalau file belum terbuka, server meminta desktop membukanya di tab latar belakang, atau mengembalikan error "buka file dulu" (MVP).
   - **Eksekusi headless (nanti):** untuk operasi baca dan batch saat file tidak terbuka, pakai engine di Node (docx/pptx-engine, sidecar xlsx).
   - Tool yang memanggil LLM internal (`generate_deck`, `generate_image`, `plan_deck`) **tidak diekspos**, karena agen ACP sudah memakai modelnya sendiri.
   - Agen tetap memakai izin ACP yang sudah ada di OK (`permissions.ts`).
5. **Loop AI bawaan AugmentOffice** (`agent-core`, `ai-provider`, BYOK) **tidak di-port**. Semua AI lewat ACP di OK.

### 3.3 Diagram

```
Electron (packages/desktop)
 ├─ renderer: packages/app  ── tab office ──> packages/office-{docs,sheets,slides,pdf}
 │                 ▲  WS (relay tool + file-change)            │ bytes via HTTP
 └─ utility: packages/server ───────────────────────────────────┘
        ├─ /api/office/file (load/save atomik)   ├─ sidecar xlsx-engine (Rust)
        ├─ MCP /mcp: docx_* xlsx_* pptx_* → relay ke tab
        └─ acp/thread-manager → opencode acp | pi-acp | gemini --acp | agy_acp_server
```

## 4. Roadmap

| Fase | Isi | Perkiraan |
|---|---|---|
| 0 Fondasi | Build dan jalan di Fedora, matikan workflow upstream, audit telemetri/cloud, NOTICE/lisensi, rebrand minimal | 1–2 minggu santai |
| 1 Kerangka office | Registry tipe dokumen, tab `office`, endpoint load/save, port engine sebagai paket, relaksasi lint untuk paket port | 1–2 minggu |
| 2 Docs (.docx) | Editor docs (buka, edit, simpan), toolbar, lalu MCP `docx_*` + relay, uji dengan OpenCode/Pi | 2–3 minggu |
| 3 Sheets (.xlsx) | Build sidecar Rust, editor Univer, save, lalu MCP `xlsx_*` | 2–3 minggu |
| 4 Slides (.pptx) | Editor Konva, save, lalu MCP `pptx_*` | 2–3 minggu |
| 5 PDF (opsional) | Viewer/editor PDF menggantikan `AssetPreview` pdf, lalu MCP `pdf_*` | 1–2 minggu |
| 6 Rilis | rpm Fedora (deb opsional), update feed ke fork, smoke test e2e | 1 minggu |

## 5. Risiko

- **Ukuran dan kompleksitas.** OK berisi sekitar 7 ribu file dan memakai pnpm 12, Node 24, TypeScript 7, serta turbo. Port editor (sekitar 11 ribu baris tool AI ditambah engine sekitar 33 ribu baris) akan memakan waktu. Kerjakan satu tipe per fase.
- **Lint ketat OK.** Ada aturan no-comments, oxlint dengan aturan `ok/*`, knip, dan biome. Kode AugmentOffice penuh komentar. Solusinya: kecualikan `packages/office-*` dari aturan no-comments dan dari sebagian aturan `ok/*`, karena menghapus komentar dari kode port akan merusak atribusi dan menyulitkan merge dari upstream AugmentOffice.
- **Perbedaan versi.** Electron 44 vs 43, Vite 8 vs 7, TypeScript 7 vs 5.9, TipTap 3.22 vs 3.29. TipTap ada dua instance (markdown OK dan docs), jadi pastikan dedupe atau isolasi schema.
- **Sidecar Rust** butuh cargo di Fedora, plus target build per arsitektur untuk rpm.
- **OK adalah mirror Copybara** dari monorepo privat. Riwayat upstream sering berubah, sehingga sync ke upstream akan berat. Strateginya: perubahan ditaruh di paket baru, dan sentuhan ke file inti dibuat sekecil mungkin.
- **Workflow upstream** (`linear-pr-relay`, `monorepo-pr-bridge`, `desktop-release`, …) butuh secret Inkeep, jadi harus dimatikan atau dihapus di fork.
- **Telemetri dan jaringan:**
  - OTel hanya aktif lewat `VITE_OTEL_ENABLED`/`OTEL_EXPORTER_OTLP_ENDPOINT`.
  - Laporan skills.sh default mati.
  - Yang masih menghubungi internet:
    - auto-update (`publish: inkeep/open-knowledge`)
    - share link `openknowledge.ai/d/`
    - `openknowledge.ai/api/subscribe`
    - registry ACP dari CDN (`cdn.agentclientprotocol.com`)
    - pencarian skills.sh dan GitHub
    - preview link GitHub
  - Semua ini perlu dinonaktifkan atau diarahkan ulang di fase 0.
- **Antigravity ACP** adalah biner proprietary dari Google, dan Pi lewat `pi-acp` 0.0.x. Keduanya bisa berubah sewaktu-waktu.
