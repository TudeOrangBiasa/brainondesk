# Privasi dan koneksi keluar (BrainOnDesk)

Fork ini ditujukan untuk desktop lokal. Semua layanan cloud milik Inkeep/OpenKnowledge dimatikan lewat satu flag, yaitu `UPSTREAM_CLOUD_SERVICES_ENABLED = false` di `packages/core/src/constants/feature-flags.ts`.

## Dimatikan (flag `UPSTREAM_CLOUD_SERVICES_ENABLED`)

| Fitur | Tujuan sebelumnya | Titik yang dimatikan |
|---|---|---|
| Auto-update | `openknowledge.ai/updates` (proxy) dan GitHub Releases `inkeep/open-knowledge` | `startAutoUpdater` di `packages/desktop/src/main/index.ts` tidak lagi memanggil `bootAutoUpdater`. Menu dan palet "Check for updates" juga disembunyikan. |
| Laporan bug | `openknowledge.ai/api/feedback/attachment` | Item menu, palet perintah, `ReportBugMenuTrigger`, dan ajakan lapor setelah crash (`ReportBugCrashInviteTrigger`) disembunyikan. |
| Kirim feedback | `openknowledge.ai/api/feedback` | Item menu, palet perintah, `FeedbackMenuTrigger`, dan kartu feedback di sidebar disembunyikan. |
| Feedback saat uninstall | `openknowledge.ai/api/feedback` | Langkah feedback uninstall di desktop (`runDesktopUninstallFeedbackStep`) dan CLI (`promptUninstallFeedback`) dilewati, jadi tidak ada pertanyaan dan tidak ada request. |
| Langganan email | `openknowledge.ai/api/subscribe` | `SubscribeCard` tidak tampil. Notifikasi "what's new" tetap muncul tanpa form email. |
| Share link | `openknowledge.ai/d/…` | Tombol Share di header dan dialog penerima share disembunyikan. Tool MCP `share_link` masih terdaftar karena hanya menyusun URL tanpa request jaringan; tool ini akan dihapus bersama test-nya di tiket lanjutan. |

## Mati secara default (perilaku upstream, tidak diubah)

- **OpenTelemetry:** renderer hanya aktif kalau `VITE_OTEL_ENABLED=true` saat build. Proses main/server hanya mengirim kalau `OTEL_EXPORTER_OTLP_ENDPOINT` di-set.
- **Laporan install skill ke skills.sh:** setting `telemetry.skillInstallReports.enabled` default `false`. Laporan ini juga tidak dikirim kalau `DO_NOT_TRACK` atau `DISABLE_TELEMETRY` aktif.

## Masih aktif (dipakai saat fitur terkait digunakan)

- **Katalog agen ACP** (`cdn.agentclientprotocol.com/registry/v1/latest/registry.json`): daftar agen untuk panel agen (OpenCode, Pi, Gemini, Antigravity, dll). Kalau offline, katalog gagal dimuat, tapi agen custom tetap bisa dipakai.
- **Instalasi agen**: unduhan paket npm/uvx atau biner dari registry, hanya saat pengguna memasang agen.
- **Pencarian skills.sh dan GitHub** di tab Explore Skills, hanya saat pengguna mencari.
- **Preview link GitHub** (issue/PR) dan sinkronisasi git ke remote pengguna sendiri.
- **Jumlah star GitHub** di Help popover (`api.github.com`). Akan diarahkan ke repo fork oleh tiket rebrand.

## Cara memeriksa

Jalankan aplikasi lalu pantau koneksi keluar, misalnya `strace -f -e trace=connect -p <pid>` atau `ss -tp`. Dalam pemakaian normal (buka proyek, edit, chat agen) tidak boleh ada koneksi ke `openknowledge.ai` atau `inkeep.com`.

Pada build headless di box (sebelum perubahan ini), log desktop menunjukkan `setFeedURL (proxy) — updater feed pointed at the openknowledge.ai proxy`. Setelah perubahan ini, baris tersebut seharusnya tidak muncul lagi.
