# Panduan Email (Resend): kode verifikasi & notifikasi email

ABC Selaras mengirim email lewat **Resend** (gratis 3.000 email/bulan, 100/hari) melalui Edge Function `send-email` di Supabase.

## 1. Daftar Resend & verifikasi domain
1. Buka https://resend.com → **Sign up** (pakai email kantor/Marcomm).
2. **Domains → Add Domain** → isi `abcselaras.my.id` → Region bebas (mis. Tokyo/Singapore).
3. Resend menampilkan beberapa record DNS (**MX**, **TXT/SPF**, **TXT/DKIM**). Tambahkan semuanya di panel DNS **Indodomains** untuk domain `abcselaras.my.id` (Kelola Domain → DNS Management). Nama host & nilai harus persis.
4. Kembali ke Resend → **Verify DNS Records**. Tunggu sampai status **Verified** (biasanya 5–60 menit).

> Tanpa domain terverifikasi, Resend hanya bisa mengirim ke email pemilik akun Resend sendiri.

## 2. API key
Resend → **API Keys → Create API Key** (Permission: Sending access) → salin `re_...`. **Rahasia**, jangan dibagikan.

## 3. Secrets di Supabase
Dashboard Supabase → **Edge Functions → Secrets** → tambah:
- `RESEND_API_KEY` = `re_...`
- `FROM_EMAIL` = `ABC Selaras <noreply@abcselaras.my.id>`

## 4. Deploy fungsi `send-email`
Edge Functions → **Deploy a new function → Via Editor** → nama **`send-email`** → hapus isi contoh, tempel seluruh isi `supabase/functions/send-email/index.ts` → **Deploy**. Lalu buka fungsi → **Details** → matikan **Verify JWT** → Save.
(Kalau fungsi sudah ada, cukup buka → Code → tempel versi terbaru → Deploy.)

## 5. Uji
Login sebagai karyawan → **Profil → Akun Google & Email** → **Kirim kode verifikasi ke email** → masukkan kode → muncul centang hijau. Notifikasi email aktif otomatis (bisa dimatikan).

## Catatan
- Fungsi hanya mengirim ke email yang terdaftar di data ABC Selaras (karyawan aktif / akun HR), jadi tidak bisa dipakai mengirim spam.
- Karyawan hanya menerima notifikasi email bila emailnya **terverifikasi** dan saklar **Notifikasi lewat email** menyala.
- Akun HR (email di Pengaturan → Akun HR) menerima salinan notifikasi HR.
