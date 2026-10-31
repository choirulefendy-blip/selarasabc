# Panduan FCM — Notifikasi Android saat Aplikasi Tertutup

Tanpa FCM, notifikasi di APK hanya muncul saat aplikasi sedang dibuka. Dengan FCM, HP menerima notifikasi (tugas, absen telat, pengajuan, chat) **walau aplikasi ditutup**. Gratis.

Alurnya: aplikasi mendaftarkan *token* HP ke Supabase → saat ada notifikasi, Edge Function `send-push` meminta Firebase mengirimnya ke HP.

## 1. Buat project Firebase (sekali)
1. Buka https://console.firebase.google.com → **Add project** (nama bebas, mis. "ABC Selaras"; Analytics boleh dimatikan).
2. Di project itu: **Add app → Android**.
   - **Android package name:** `id.abchospitality.selaras` (harus persis).
   - Klik **Register app**, lalu **Download google-services.json**. Lewati langkah SDK berikutnya.

## 2. Secret GitHub untuk build APK
Repo → **Settings → Secrets and variables → Actions → New repository secret**:
- Nama: `GOOGLE_SERVICES_JSON`
- Isi: **seluruh isi** file `google-services.json` (buka dengan Notepad, salin semua).

Lalu jalankan **Actions → Build APK Android → Run workflow**. Jika secret terisi, workflow otomatis mengaktifkan FCM di APK; jika kosong, muncul peringatan kuning dan APK tetap jadi (tanpa FCM).
**Pasang ulang APK baru** di HP.

## 3. Kunci server untuk Edge Function
1. Firebase Console → ⚙️ **Project settings → Service accounts → Generate new private key** → unduh file JSON. **Rahasia — jangan di-commit / dibagikan.**
2. Set sebagai secret Supabase (CLI), dari folder tempat file berada:
   ```
   supabase secrets set FCM_SERVICE_ACCOUNT="$(cat nama-file-kunci.json)"
   ```
   (Atau Dashboard Supabase → Edge Functions → Secrets → tambah `FCM_SERVICE_ACCOUNT`, tempel seluruh isi JSON.)
3. Deploy fungsi `send-push`:
   - **Tanpa CLI (Dashboard):** Edge Functions → **Deploy a new function → Via Editor** → nama `send-push` → hapus isi contoh, tempel seluruh isi `supabase/functions/send-push/index.ts` → **Deploy**. Lalu buka fungsi → **Details** → matikan **Verify JWT / Enforce JWT verification** → Save.
   - **Dengan CLI:** `supabase functions deploy send-push --no-verify-jwt`
   `PUSH_FUNCTION_URL` di `web/index.html` sudah diisi: `https://dxwrvrdvjjvmujrnawen.supabase.co/functions/v1/send-push`. Secret VAPID (Web Push browser) tidak wajib lagi kalau Anda hanya memakai FCM.

## 4. Tabel token di Supabase
Supabase → **SQL Editor** → tempel isi `supabase/fcm.sql` → **Run**.

## 5. Uji
1. Buka APK, login, izinkan notifikasi. (Sekali muncul, tabel `fcm_tokens` akan berisi 1 baris.)
2. **Tutup aplikasi** (geser dari recent apps).
3. Dari akun/perangkat lain buat kejadian: beri tugas ke akun tadi, atau kirim chat.
4. Notifikasi muncul di HP; ketuk untuk membuka halaman terkait.

## Pemecahan masalah
| Gejala | Penyebab umum |
|---|---|
| Tidak ada baris di `fcm_tokens` | `fcm.sql` belum dijalankan, secret `GOOGLE_SERVICES_JSON` kosong saat build, atau izin notifikasi ditolak |
| Baris ada, tapi tidak masuk | `FCM_SERVICE_ACCOUNT` belum di-set / fungsi belum di-deploy ulang; lihat Edge Functions → Logs. Respons fungsi memuat `fcmSent`, `fcmFailed`, `fcmError` |
| `fcmError` berisi `PERMISSION_DENIED` | API "Firebase Cloud Messaging API (V1)" belum aktif di project Google Cloud, atau service account dari project yang berbeda |
| Build gagal "package_name" | `google-services.json` bukan untuk `id.abchospitality.selaras` |

## Catatan
- Satu HP dipakai ganti-ganti akun: saat **logout** token dilepas dari akun lama, saat login terdaftar ke akun baru.
- Token yang sudah tidak valid (aplikasi dihapus) dibersihkan otomatis saat pengiriman berikutnya.
- Token tersimpan di tabel yang **tidak bisa dibaca** lewat kunci anon; hanya Edge Function (service role) yang membacanya.
