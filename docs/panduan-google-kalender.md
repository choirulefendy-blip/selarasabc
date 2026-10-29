# Menghubungkan Selaras Board ke Google Kalender

Tanpa pengaturan apa pun, tab **Agenda & Kalender** sudah bisa:

- tombol **+ Google Kalender** di tiap agenda (membuka Google Kalender dengan isian sudah terisi, tinggal Simpan)
- tombol **Unduh .ics** (bisa diimpor ke Google Kalender, Outlook, Apple Kalender)

Sinkron **langsung** (agenda Google tampil di Selaras Board + tombol **Kirim ke Google**) butuh satu kali pengaturan di Google Cloud.
Fitur ini jalan di **versi web** (browser). Di dalam APK, Google memblokir login lewat WebView, jadi APK memakai dua tombol di atas.

## Langkah (sekitar 10 menit, gratis)

1. Buka <https://console.cloud.google.com/> lalu buat project baru, misalnya `ABC Selaras`.
2. **APIs & Services → Library**, cari **Google Calendar API**, klik **Enable**.
3. **APIs & Services → OAuth consent screen**
   - User type: **External** (atau **Internal** kalau kantor memakai Google Workspace).
   - Isi nama aplikasi `ABC Selaras` dan email kontak.
   - Scopes: tambahkan `.../auth/calendar.events`.
   - Kalau External dan status **Testing**, tambahkan email staf yang akan memakai di **Test users** (maks. 100).
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - **Authorized JavaScript origins**: tambahkan
     - `https://abcselaras.my.id`
     - `https://choirulefendy-blip.github.io`
   - Klik **Create**, lalu salin **Client ID** (berakhiran `.apps.googleusercontent.com`).
5. Di `web/index.html`, isi:
   ```js
   var GOOGLE_CLIENT_ID = 'xxxxxxxx.apps.googleusercontent.com';
   ```
   lalu commit dan push. Client ID bukan rahasia (aman ada di kode web).
6. Buka Selaras Board → **Agenda & Kalender** → **Hubungkan Google Kalender**, pilih akun Google, izinkan akses kalender.

## Catatan

- Login Google berlaku sekitar 1 jam; setelah itu tekan **Hubungkan** lagi.
- Agenda yang dikirim ke Google ditandai (`selarasId`) sehingga tidak muncul dobel saat memuat agenda Google.
- Aplikasi hanya meminta izin `calendar.events` (baca/tulis agenda), bukan seluruh akun Google.
