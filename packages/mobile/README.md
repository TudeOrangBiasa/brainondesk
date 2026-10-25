# BrainOnDesk Mobile

Aplikasi Android lokal untuk BrainOnDesk. Build ini scaffold: satu layar yang menampilkan `markdownToPlainText` dari `@inkeep/open-knowledge-core`. Sync, editor, dan agen belum ada.

Build **100% di mesin sendiri**. Tidak memakai EAS Build, Expo Go yang bergantung ke cloud, OTA (`expo-updates`), atau telemetri. Tidak ada `eas.json`.

Lisensi: GPL-3.0-or-later, sama dengan repo ini. Lihat `LICENSE` dan `NOTICE` di root.

## Metro dan pnpm

Workspace ini memakai linker terisolasi pnpm. Desktop hanya mengangkat beberapa paket native ke root (`publicHoistPattern` di `pnpm-workspace.yaml`) karena electron-builder menyalinnya dari `node_modules` root. Mengganti seluruh repo ke `nodeLinker: hoisted` akan meratakan pohon itu dan mengubah layout yang sudah dijaga.

Expo SDK 54 ke atas (di sini SDK 57) menyelesaikan instalasi terisolasi pnpm. Sejak SDK 55, aplikasi di monorepo otomatis memakai `autolinkingModuleResolution`, jadi Metro dan autolinking Gradle menunjuk salinan fisik yang sama. `packages/mobile/metro.config.js` hanya menambahkan kondisi ekspor `@inkeep/source` supaya Metro mem-bundle sumber TypeScript `@inkeep/open-knowledge-core`, bukan artefak `dist` pada kondisi `default`.

React di root di-pin `19.2.5`. Expo SDK 57 memasang React 19.2.3; React Native 0.86 menerima `react` `^19.2.3`, jadi satu salinan 19.2.5 dipakai bersama. Node yang dipakai repo adalah 24.21.0 (`.node-version`), dan `engines` mensyaratkan `>=24.2.0`.

## Prasyarat Fedora

Perintah di bawah untuk Fedora Linux. JDK yang dipakai Gradle untuk SDK ini adalah 17. Android SDK yang dikompilasi aplikasi adalah platform 36 dan build-tools 36.0.0.

### Node dan pnpm

```bash
sudo dnf install -y curl xz unzip
curl -fsSL -o /tmp/node-v24.21.0-linux-x64.tar.xz https://nodejs.org/dist/v24.21.0/node-v24.21.0-linux-x64.tar.xz
sudo tar -xJf /tmp/node-v24.21.0-linux-x64.tar.xz -C /usr/local --strip-components=1
corepack enable
corepack prepare pnpm@12.8.1 --activate
node -v
pnpm -v
```

`node -v` harus `v24.21.0`. `pnpm -v` harus `12.8.1`.

### JDK 17

```bash
sudo dnf install -y java-17-openjdk-devel
sudo alternatives --set java /usr/lib/jvm/java-17-openjdk/bin/java || true
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk
java -version
```

Tambahkan `JAVA_HOME` ke `~/.bashrc` supaya tetap ada di sesi berikutnya:

```bash
printf '\nexport JAVA_HOME=/usr/lib/jvm/java-17-openjdk\nexport PATH="$JAVA_HOME/bin:$PATH"\n' >> ~/.bashrc
```

### Android SDK dan platform-tools

```bash
sudo dnf install -y android-tools
export ANDROID_HOME="$HOME/Android/Sdk"
mkdir -p "$ANDROID_HOME/cmdline-tools"
curl -fsSL -o /tmp/commandlinetools.zip https://dl.google.com/android/repository/commandlinetools-linux-15859902_latest.zip
echo '4e4c464f145a7512b57d088ac6c278c03c9eea610886b35a5e0804e74eedf583  /tmp/commandlinetools.zip' | sha256sum -c -
unzip -q /tmp/commandlinetools.zip -d "$ANDROID_HOME/cmdline-tools"
mv "$ANDROID_HOME/cmdline-tools/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
yes | sdkmanager --sdk_root="$ANDROID_HOME" --licenses
sdkmanager --sdk_root="$ANDROID_HOME" "platforms;android-36" "build-tools;36.0.0" "platform-tools"
adb version
```

Simpan variabel lingkungan:

```bash
printf '\nexport ANDROID_HOME="$HOME/Android/Sdk"\nexport PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"\nexport EXPO_NO_TELEMETRY=1\n' >> ~/.bashrc
```

`EXPO_NO_TELEMETRY=1` mematikan telemetri CLI Expo. Skrip npm di paket ini juga menyetelnya.

## USB debugging

1. Di ponsel: Pengaturan → Tentang ponsel → ketuk **Nomor build** tujuh kali sampai mode pengembang aktif.
2. Pengaturan → Sistem → Opsi pengembang → nyalakan **USB debugging**.
3. Sambungkan kabel USB. Saat diminta, izinkan komputer ini (centang selalu izinkan kalau mau).
4. Cek koneksi:

```bash
adb devices
```

Baris ponsel harus berstatus `device`. `unauthorized` berarti prompt di ponsel belum diterima. Kalau daftar kosong, cabut-pasang kabel, ganti mode USB ke transfer file, lalu jalankan `adb kill-server && adb start-server`.

### adb lewat Wi-Fi (opsional)

Ponsel dan komputer di jaringan yang sama. Dengan USB masih tersambung:

```bash
adb tcpip 5555
adb connect ALAMAT_IP_PONSEL:5555
adb devices
```

Setelah `ALAMAT_IP_PONSEL:5555` berstatus `device`, kabel boleh dicabut. Android 11 ke atas juga bisa memakai **Wireless debugging** di opsi pengembang, lalu `adb pair` dan `adb connect` dengan port yang ditampilkan ponsel.

## Menjalankan dev build di ponsel

Dari root repo:

```bash
export EXPO_NO_TELEMETRY=1
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk
export ANDROID_HOME="$HOME/Android/Sdk"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
pnpm install
pnpm --filter @inkeep/open-knowledge-mobile run android
```

Perintah itu menjalankan `expo prebuild` (kalau folder `android/` belum ada) lalu Gradle, lalu memasang app ke perangkat yang dipilih `adb`. Layar menampilkan teks polos dari markdown sampel, hasil `markdownToPlainText`.

Paketnya bernama `@inkeep/open-knowledge-mobile`. Filter `pnpm --filter mobile` tidak memilihnya; pakai nama paket atau path:

```bash
pnpm --filter @inkeep/open-knowledge-mobile run android
pnpm --filter ./packages/mobile run android
```

Metro jalan di mesin ini. Ponsel memuat bundle dari komputer, jadi keduanya harus bisa saling capai (USB, atau Wi-Fi yang sama). Tidak ada unggahan ke server Expo.

## APK debug tanpa memasang ke ponsel

```bash
pnpm --filter @inkeep/open-knowledge-mobile run assemble:debug
```

APK ada di:

```text
packages/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

Pasang manual:

```bash
adb install -r packages/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

Folder `android/` dan `ios/` dibuat oleh `expo prebuild` dan tidak di-commit. Prebuild SDK 57 menghapus lalu menulis ulang folder itu. Jangan menyimpan perubahan manual di sana.

## Yang sengaja tidak ada

- `eas.json` dan EAS Build / EAS cloud
- `expo-updates` dan URL OTA
- Expo Insights, Sentry, dan notifikasi push
- Expo Go sebagai jalur build
