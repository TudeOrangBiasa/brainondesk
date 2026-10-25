# Rencana: Editor Office di BrainOnDesk (refresh 2026-10-25)

Status: sebagian fondasi dan engine **sudah di-port**. Dokumen ini menggantikan
draft lama (PR #1, "belum ada kode yang di-port") dan menjadi sumber kebenaran
kini. Pelacak utama tetap epic #26 (plus revisi 2026-10-22 yang nyambung ke
epic #67).

## 1. Ringkasan: shipped vs sisa

| Area | Status | Bukti |
|---|---|---|
| Engine `docx` (parse/patch/generate) | ✅ shipped | `packages/office-docx/src/{parse,patch,generate,math,section}.ts` + 50+ test |
| Sidecar Rust `xlsx-engine` + client server | ✅ shipped | `packages/office-sheets/native/xlsx-engine/src/*.rs`, `packages/server/src/xlsx-sidecar/` |
| Engine `pptx` (parse/patch) | ✅ shipped | `packages/office-pptx/src/*.ts` + 50+ test |
| Render `pptx` (render-tree, geometry, text-layout) | ✅ shipped | `packages/office-pptx-render/src/*.ts` + 8 test |
| Parse lampiran (`file-parse`: docx/pptx/xlsx/pdf → teks) | ✅ shipped | `packages/office-parse/src/*.ts` |
| Metrik font (sfnt, font-locate) | ✅ shipped | `packages/office-fonts/src/*.ts` |
| Registry tipe dokumen (`docs/sheets/slides`) | ✅ shipped | `packages/core/src/office/doc-types.ts` |
| Tab `office`, routing lazy, save-bar, dirty-store | ✅ shipped (stub editor) | `packages/app/src/office/`, `OfficeEditorHost.tsx`, `EditorArea.tsx` |
| Endpoint load/save atomik (`GET/PUT /api/office/file`, ETag/409) | ✅ shipped | `packages/server/src/http/office-routes.ts`, `services/office-files.ts` |
| Relay MCP ke tab (`office_echo`, `office_list_open`) | ✅ scaffold saja | `packages/server/src/mcp/tools/office{,-relay}.ts` |
| Lisensi/atribusi Apache-2.0 per paket | ✅ shipped | `LICENSE.upstream` + `NOTICE.upstream` + `UPSTREAM.md` di tiap paket, `docs/office/LICENSING.md` |
| Dokumen fondasi (CI, Fedora, privasi) | ✅ shipped | `docs/office/{CI,FEDORA,PRIVACY}.md` |
| Editor Docs penuh (TipTap + toolbar) | ❌ belum | `OfficeDocsEditor.tsx` masih stub shell |
| Editor Sheets penuh (Univer + edit sel) | ❌ belum | `OfficeSheetsEditor.tsx` masih stub shell |
| Editor Slides penuh (Konva) | ❌ belum | `OfficeSlidesEditor.tsx` masih stub shell |
| MCP `docx_*` / `xlsx_*` / `pptx_*` per tipe | ❌ belum | hanya `office_echo`/`office_list_open` |
| Editor PDF | ❌ opsional, belum diputuskan | hanya ekstraksi teks via `office-parse/src/pdf.ts` (pdfjs) |
| Packaging rpm + smoke e2e office | ❌ fase 6 | — |

Tidak ada paket `office-pdf`. PDF tetap **opsional** seperti rencana awal.

## 2. Yang sudah jalan (detail)

### 2.1 Engine docx — `packages/office-docx`

Port utuh `packages/docx-engine` GenOffice (`UPSTREAM.md`: GenOffice
`39a32863`, 2026-08-12). Isi: Block tree parse dengan `docxIndex` anchors
(`src/parse.ts`), paragraph-patch save (`src/patch.ts`), fragment generation
(`src/generate.ts`), math OMML↔LaTeX (`src/math.ts`), sections/watermark/notes/
ink/sources/theme/protection/symbol-fonts/list-markers. Test: 50+ file di
`tests/` (sections, textbox-edit, smartart-ole, vml-textbox, dst).

### 2.2 Sheets sidecar — `packages/office-sheets` + server

Port `apps/sheets` AugmentOffice: crate Rust `xlsx-sidecar` verbatim
(`native/xlsx-engine/src/{lib,main,recalc,convert,archive,visuals,
shared_formulas}.rs`) untuk streaming read dan surgical save. TS client-nya
diadaptasi ke konvensi server BrainOnDesk dan tinggal di
`packages/server/src/xlsx-sidecar/` (spawn lazy + reap idle timer, resolver
`resolveXlsxSidecarBinary` dari `office-sheets/binary`). Test Rust via
`cargo test` (`native:test`); integrasi spawn ada di
`packages/server/src/xlsx-sidecar/spawn.uncached.test.ts`.

### 2.3 Engine + render pptx — `packages/office-pptx`, `office-pptx-render`

Port `packages/pptx-engine` (parse/patch: `slide-transfer`, `table-edit`,
`table-style`, `theme-apply`, `smartart*`, dst) dan `packages/pptx-render`
(render-tree, `build-slide`, `build-chart`, `preset-geometry`,
`connector-geometry`, `text-layout`, `coords`, `fill`, `metrics`; font
di-inject host via antarmuka `OpentypeFontLike`, tanpa `opentype.js`).
Fixture `.pptx` turunan template python-pptx dicatat di
`tests/fixtures/LICENSE-python-pptx.txt`.

### 2.4 Parse lampiran + font — `packages/office-parse`, `office-fonts`

`office-parse` (dari GenOffice `file-parse`): docx/pptx/xlsx/pdf → teks untuk
agen/lampiran; PDF lewat `pdfjs-dist` murni-JS plus polyfill `DOMMatrix`
(`src/pdf.ts`) supaya tidak pecah di build kemas. `office-fonts` (dari
`font-metrics`): `sfnt` table read tertarget + `font-locate` sistem untuk
proses main Electron, tanpa parse file font utuh.

### 2.5 Kerangka app + server (fase 1, sebagian besar selesai)

- Registry bersama: `OFFICE_DOC_TYPES` (`docs/sheets/slides`, `doc/docx/odt`,
  `xls/xlsx/ods`, `ppt/pptx/odp`) + `isOfficeDocFile()` di
  `packages/core/src/office/doc-types.ts` (+ test). Dipakai file tree
  (`FileTree.tsx`), ikon (`file-entry-icon`), routing hash (`App.tsx`),
  `AssetPreview` placeholder, dan `OfficeEditorHost`.
- Tab `kind: 'office'` dengan editor lazy per tipe (`EditorArea.tsx`,
  `OfficeEditorHost.tsx` + `OfficeDocs/Sheets/SlidesEditor.tsx`), save-bar
  (Save/Reload + status conflict), dan `office-dirty-store.ts` untuk dirty dot
  di tab. **Catatan jujur: ketiga editor masih stub shell** — routing,
  load/reload/save bytes, dan status dirty sudah jalan, tapi TipTap/Univer/
  Konva belum di-port.
- Server: `GET/PUT /api/office/file` (`http/office-routes.ts` +
  `services/office-files.ts`) — load bytes dengan ETag, save atomik, 409 saat
  ETag basi, tolak traversal dan tipe non-office. Test:
  `api-office-file.test.ts`.
- MCP: `office_echo` + `office_list_open` (`mcp/tools/office{,-relay}.ts` +
  test relay round-trip/timeout/cancel/path-safety). Ini **scaffold jalur
  relay server→tab**, bukan tool per tipe.

### 2.6 Lisensi, CI, Fedora, privasi (fase 0 selesai)

Aturan port tercatat di `docs/office/LICENSING.md` dan sudah dijalankan:
tiap paket `office-*` punya `UPSTREAM.md` (repo + commit + path + adaptasi),
`LICENSE.upstream` (Apache-2.0), `NOTICE.upstream`, dan header
`SPDX-License-Identifier: Apache-2.0`. Pengecualian lint untuk paket port
dibawa PR engine (#34). Dokumen pendukung: `CI.md` (gerbang `verify`),
`FEDORA.md` (build/dev/packaging), `PRIVACY.md`
(`UPSTREAM_CLOUD_SERVICES_ENABLED = false`).

## 3. Arsitektur final vs rencana awal

Yang masih sesuai rencana lama: file biner **tidak lewat CRDT** (tab `office`
+ load/save HTTP), sidecar xlsx dijalankan server Node, agen menyentuh office
lewat MCP yang di-relay ke tab hidup, loop AI bawaan AugmentOffice
(`agent-core`, `ai-provider`, BYOK) **tidak di-port** — semua AI lewat ACP.

Yang berubah dari rencana awal:

1. **Editor penuh belum ada.** Rencana lama menaruh `packages/office-docs/
   office-sheets/office-slides` (React + TipTap/Univer/Konva) sebagai paket
   renderer. Kini yang ada hanya stub di `packages/app/src/office/` +
   `components/Office*Editor.tsx`. Port UI editor penuh adalah fase berikut
   terbesar.
2. **MCP per tipe belum ada.** Rencana lama (`docx_*`, `xlsx_*`, `pptx_*`
   dari `apps/*/src/renderer/ai/tools.ts`) belum di-port; yang ada hanya
   `office_echo`/`office_list_open` sebagai bukti jalur relay.
3. **Eksekusi headless via engine belum ada.** Engine docx/pptx bisa dipakai
   di Node (murni TS: jszip + fast-xml-parser), tapi belum ada tool MCP yang
   memakainya saat file tidak terbuka.
4. **Revisi 2026-10-22 (epic #67):** editor office menjadi built-in docType
   plugin lazy (kontrak #83/#84, 0 KB sampai tipe itu dibuka), sidecar jalan
   dari server Bun (spawn lazy + reap idle — sudah begitu), packaging bawa
   sidecar, checklist rilis + perf baseline (#68).

## 4. Klaim lama yang kedaluwarsa (koreksi eksplisit)

- "Belum ada kode yang di-port" — **salah kini**: 6 paket engine + kerangka
  app/server/MCP di atas sudah ada.
- "Paket `packages/office-{docs,sheets,slides,pdf}` (React)" — **belum ada**;
  yang ada `office-{docx,sheets,pptx,pptx-render,parse,fonts}` (engine +
  sidecar + util, tanpa UI editor).
- "MCP `docx_*`/`xlsx_*`/`pptx_*` + relay utama" — **baru scaffold**
  (`office_echo`); tool per tipe dan `AgentSkill.executeTool()` di tab belum ada.
- Estimasi fase 0–1 (1–2 minggu santai) dan asumsi versi (Electron 44 vs 43,
  TipTap 3.22 vs 3.29, dsb) — **tidak lagi jadi patokan**; fase 0–1 sebagian
  besar selesai tanpa mengikuti jadwal itu.

## 5. Fase berikut

1. **Editor Docs penuh** (epic #12–#15): port TipTap + `docx-engine` binding
   ke `OfficeDocsEditor` (buka/render → edit/simpan/dirty/undo), lalu MCP
   `docx_*` + verifikasi OpenCode/Pi.
2. **Editor Sheets penuh** (#17–#18): port Univer, sambungkan ke sidecar yang
   sudah jalan, lalu MCP `xlsx_*`.
3. **Editor Slides penuh** (#19–#21): port Konva + `pptx-render`, lalu MCP
   `pptx_*`.
4. **Keputusan PDF** (#22–#23, opsional): tetap ekstraksi-teks saja, atau port
   viewer/editor PDF. Sampai diputuskan, PDF bukan cakupan.
5. **Rilis** (#24–#25 + revisi #67/#68): rpm Fedora bawa sidecar, smoke e2e
   tipe office, perf baseline.

Aturan tetap: PR ready + Conventional Commits, `risk:high` ditahan sampai PASS
independen, merge oleh Tude; desktop Electron/Fedora dulu; folder `ee/`
GenOffice jangan disentuh; `agent_*`/BYOK internal tidak di-port.

## 6. Referensi file (klaim-vs-file)

- Engine: `packages/office-docx/src/index.ts`,
  `packages/office-pptx/src/`, `packages/office-pptx-render/src/`,
  `packages/office-parse/src/`, `packages/office-fonts/src/`,
  `packages/office-sheets/native/xlsx-engine/src/`.
- Asal-usul: `UPSTREAM.md` + `LICENSE.upstream` + `NOTICE.upstream` di tiap
  paket; aturan di `docs/office/LICENSING.md`.
- App: `packages/core/src/office/doc-types.ts`,
  `packages/app/src/office/`, `packages/app/src/components/Office*Editor.tsx`,
  `EditorArea.tsx`, `App.tsx`, `FileTree.tsx`, `AssetPreview.tsx`.
- Server: `packages/server/src/http/office-routes.ts`,
  `services/office-files.ts`, `xlsx-sidecar/`,
  `mcp/tools/office{,-relay}.ts` (+ `*.test.ts` masing-masing).
- Epic: `gh issue view 26 --json body` (fase 0–6, revisi 2026-10-22 → #67).
