# ABC Selaras — HR & Penggajian ABC Hospitality Group

Aplikasi web (PWA) untuk absensi, jadwal, cuti, lembur, KPI, penggajian, **banner**, **To-Do List**, dan **notifikasi**,
dengan backend Supabase, hosting Netlify, dan **paket APK Android** (Capacitor) yang dibuild otomatis oleh GitHub Actions.

```
abc-selaras/
├─ web/                 ← aplikasi (index.html, sw.js, manifest.json, ikon) — ini yang di-deploy Netlify
├─ supabase/            ← schema.sql + Edge Functions (send-push, send-email)
├─ mobile/              ← proyek Android (Capacitor) → APK
├─ test/                ← tes otomatis (jsdom), jalan juga di GitHub Actions
├─ docs/                ← panduan lengkap Supabase/Push/Email
├─ netlify.toml
└─ .github/workflows/   ← android-apk.yml (build APK) dan test.yml
```

## 1. Deploy lewat GitHub → Netlify

1. Buat repo **private** di GitHub, lalu upload isi folder ini (atau `git init && git remote add origin … && git push`).
2. Netlify → **Add new site → Import an existing project → GitHub** → pilih repo.
3. Isi: **Build command**: *(kosongkan)* · **Publish directory**: `web` (sudah diatur di `netlify.toml`) → **Deploy**.
4. Setiap `git push` ke `main` otomatis memperbarui situs. Tidak ada langkah build.

> Konfigurasi Supabase (`SUPABASE_URL` dan `SUPABASE_ANON_KEY`) ada di bagian atas `web/index.html`. Anon key memang
> dirancang publik, tetapi tetap gunakan repo **private**. **Jangan** pernah memasukkan `service_role` key atau
> `VAPID_PRIVATE_KEY` ke repo — keduanya hanya boleh jadi *secret* di Supabase.

### Supabase
Jalankan `supabase/schema.sql` di SQL Editor (kalau belum). Push & email bersifat opsional — langkahnya ada di
`docs/panduan-supabase-push-email.md`. Tanpa push server, notifikasi tetap muncul di lonceng dan sebagai notifikasi
sistem selama aplikasi/tab terbuka (lihat bagian 4).

## 2. Fitur baru

| Fitur | Cara kerja |
|---|---|
| **Banner** | Menu **HR → Banner**: tambah/ubah/hapus, judul + teks, warna atau gambar (≤1.5 MB), tampil/sembunyikan, atur urutan. Tampil sebagai carousel otomatis di dashboard **HR, HOD, dan Staff**. |
| **To-Do List** | Setiap akun punya daftar tugas sendiri (prioritas, tenggat, status Belum/Dikerjakan/Selesai). **HR** memantau semua karyawan (filter departemen/karyawan/status, ringkasan progres) dan bisa menugaskan; **HOD** memantau & menugaskan timnya. Widget ringkasan ada di dashboard. |
| **Notifikasi To-Do** | HR dinotifikasi saat staf menambah/menyelesaikan tugas; staf dinotifikasi saat ditugaskan; HOD dinotifikasi saat tugas yang ia berikan selesai. |
| **Aktivitas Saya** | Menu staf & HOD: timeline pribadi 3 bulan — absen masuk/pulang (telat, lokasi, catatan) dan aktivitas akun (tugas dsb.). Bisa difilter. |
| **Peringatan absen** | Saat absen masuk **telat**, atau absen masuk/pulang **di luar radius kantor / GPS tidak terdeteksi**, HR langsung dapat notifikasi. Dashboard HR juga punya kartu *Peringatan Absen Hari Ini*. |
| **Pengaturan Notifikasi** | Menu **Notifikasi** di semua akun: saklar utama + per kategori (HR: telat, luar jangkauan, To-Do, pengajuan; Staff: To-Do, pengajuan). Kategori yang dimatikan tidak dikirim sama sekali. Pengaturan HR berlaku untuk semua akun HR. Tombol *Aktifkan Notifikasi Perangkat* mengatur izin di perangkat. |
| **Sinkronisasi live** | Tiap 30 detik aplikasi menarik notifikasi, tugas, dan absen baru dari server tanpa perlu muat ulang. |

## 3. Paket APK Android

APK dibuild oleh **GitHub Actions** (butuh Android SDK + Gradle, tidak bisa dibuild di sembarang mesin tanpa itu):

1. Push repo ke GitHub → tab **Actions** → workflow **Build APK Android** (jalan otomatis saat `web/` atau `mobile/` berubah; atau klik **Run workflow**).
2. Setelah hijau (± 5–8 menit), buka run-nya → bagian **Artifacts** → unduh **ABC-Selaras-debug-apk** → ekstrak → `app-debug.apk`.
3. Kirim ke HP Android → buka → izinkan *Install dari sumber tidak dikenal* → pasang.
4. Memberi tag `v1.0.0` (`git tag v1.0.0 && git push --tags`) juga melampirkan APK ke halaman **Releases**.

APK **debug** sudah bisa dipakai dan dipasang. Untuk APK **release** bertanda tangan (mis. untuk Play Store), buat keystore dan isi
*Settings → Secrets → Actions*: `ANDROID_KEYSTORE_BASE64` (isi file keystore di-base64), `ANDROID_KEYSTORE_PASSWORD`,
`ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` — workflow otomatis ikut membuat `app-release.apk`. Simpan keystore baik-baik;
kalau hilang, update aplikasi tidak bisa dipasang menimpa versi lama.

Aplikasi Android membungkus isi folder `web/` (ID paket `id.abchospitality.selaras`, ikon dari logo *abc selaras*, izin kamera, lokasi, dan notifikasi).
Ubah aplikasi → push → APK baru dibuild. Untuk membuka di Android Studio: `cd mobile && npm install && npx cap sync android && npx cap open android`.

## 4. Catatan notifikasi di APK & browser

- **Aplikasi Android:** notifikasi tampil di bilah Android saat aplikasi berjalan (terbuka atau sebentar di latar belakang); data ditarik
  tiap 30 detik. WebView Android **tidak mendukung Web Push**, jadi notifikasi saat aplikasi benar-benar ditutup belum ada. Itu
  butuh Firebase Cloud Messaging (proyek Firebase + `google-services.json`) — bisa ditambahkan sebagai tahap lanjutan.
- **Browser/PWA:** dengan Edge Function `send-push` ter-deploy, push masuk walau situs ditutup. Tanpa itu, notifikasi muncul selama tab/PWA terbuka.

## 5. Tes

```
cd test && npm install && npm test
```
57 pemeriksaan: banner, To-Do (termasuk hak akses), notifikasi telat/luar jangkauan, preferensi notifikasi, Aktivitas Saya,
sinkronisasi live, dan render semua halaman semua peran. Tes juga jalan otomatis di GitHub Actions (`test.yml`).

## 6. Keterbatasan yang perlu diketahui

- Seluruh data disimpan sebagai satu dokumen; penyimpanan bersifat *last-write-wins*. Sinkronisasi live menggabungkan notifikasi, tugas,
  log aktivitas, dan absen agar tidak saling menimpa, tetapi modul lain (cuti, lembur, KPI, jadwal) masih bisa tertimpa bila dua orang
  menyimpan bersamaan.
- Login masih sebatas pemisah tampilan (password tersimpan apa adanya di data). Cukup untuk pemakaian internal; belum setingkat produksi.
