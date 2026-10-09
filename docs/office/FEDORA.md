# Build & jalan di Fedora

Panduan ini membangun BrainOnDesk dari source di Fedora (sudah diuji di Fedora 42+). Semua alat yang dipakai FOSS.

## 1. Dependensi sistem

```bash
sudo dnf install -y git make gcc-c++ python3 libsecret-devel xorg-x11-server-Xvfb
```

- `make` dan `gcc-c++` dibutuhkan node-gyp untuk build ulang modul native (`@parcel/watcher`, `node-pty`).
- `libsecret` menyimpan kredensial di keyring.
- Xvfb hanya perlu untuk menjalankan app secara headless (CI atau SSH).

**Rust:** rustc dari dnf terlalu lama untuk addon `native-config` (butuh 1.99). Pakai rustup:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain none
source ~/.cargo/env
```

`rust-toolchain.toml` akan memasang versi yang tepat secara otomatis.

**Node 24.21.0** (lihat `.node-version`), lewat fnm atau langsung:

```bash
curl -fsSL https://fnm.vercel.app/install | bash   # atau: dnf install fnm (kalau tersedia)
fnm install && fnm use
corepack enable   # pnpm 12 sesuai packageManager
```

## 2. Install & build

```bash
pnpm install
pnpm run build       # ±2 menit, 9 task turbo
pnpm run typecheck
pnpm run lint
```

`postinstall` menampilkan error build ulang `node-liblzma` (`-Werror`). Error ini **aman diabaikan** karena modul itu tidak dipakai di Linux.

## 3. Mode dev (Electron + HMR)

```bash
pnpm --filter @inkeep/open-knowledge-desktop run dev
```

Masalah yang mungkin muncul:

- **`Error: Electron uninstall`.** Binary Electron belum terunduh (misalnya karena install `--offline`). Jalankan:
  ```bash
  node packages/desktop/node_modules/electron/install.js
  ```
- **`Too many open files (os error 24)` dari rolldown.** Batas instance inotify terlalu kecil. Naikkan:
  ```bash
  sudo sysctl fs.inotify.max_user_instances=1024
  ```
  Supaya permanen, tambahkan baris itu ke `/etc/sysctl.d/99-inotify.conf`.

## 4. Build app Linux (tanpa installer)

```bash
pnpm --filter @inkeep/open-knowledge-desktop run build:dir:linux
./packages/desktop/dist-desktop/linux-unpacked/brainondesk   # sebelum PR rebrand: ./openknowledge
```

Catatan: `build:dir` biasa (tanpa `--linux`) gagal di Linux karena tetap mencoba build ulang `node-liblzma`. Pakai `build:dir:linux`. Hasilnya sekitar 475 MB.

Untuk installer `.rpm`/`.deb`/AppImage, pakai `build:linux` (butuh `rpm-build`). Status: belum diuji, menyusul di Fase 6.

## 5. Server/CLI saja (tanpa GUI)

```bash
node packages/cli/dist/cli.mjs init --no-mcp --no-skills --local-only
node packages/cli/dist/cli.mjs start --no-open-browser -p 47123
# UI:  http://localhost:47123
# MCP: http://localhost:47123/mcp
```

## 6. Headless (SSH/CI)

```bash
xvfb-run -a ./packages/desktop/dist-desktop/linux-unpacked/brainondesk --no-sandbox --disable-gpu
```

Pesan error `dbus/bus.cc` di container tanpa D-Bus aman diabaikan. Log ada di `~/.ok/logs/desktop.*.log`. Cari `startup appReady` dan `startup windowShown` untuk memastikan app sudah jalan.

## Hasil verifikasi di box (Debian, headless)

- `build` ✅
- `typecheck` ✅
- `lint` ✅
- `build:dir:linux` ✅
- `dev` ✅: appReady, windowShown, navigator loaded
- Binary hasil build di Xvfb ✅: jalan 45 detik tanpa crash
- `ok start` ✅: UI HTTP 200, `initialize` MCP OK

Belum diuji: GUI sungguhan di Fedora (Wayland/GNOME), paket rpm, dan sandbox Chromium (`chrome-sandbox` setuid).
