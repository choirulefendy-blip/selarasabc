# Mengaktifkan Asisten AI (Gemini) di ABC Selaras

Fitur AI memakai Google Gemini lewat Supabase Edge Function `ai`. Fiturnya:
**Asisten Selaras** (chat), tombol **Rapikan dengan AI**, **Insight AI** di dashboard HR/HOD, dan **Saran Jadwal AI** untuk HOD.

> API key Gemini **tidak boleh** ditaruh di aplikasi atau di GitHub (repo ini publik).
> Key hanya disimpan sebagai *secret* di Supabase.

## 1. Simpan API key sebagai secret

1. Buka **Supabase Dashboard** → project ABC Selaras → **Edge Functions** → **Secrets**.
2. Tambah secret:
   - **Name:** `GEMINI_API_KEY`
   - **Value:** API key dari Google AI Studio.
3. Opsional:
   - `GEMINI_MODELS`: urutan model, dipisah koma, misalnya `gemini-3.8-flash,gemini-2.5-flash,gemini-3.1-flash-lite`.
   - `AI_DAILY_LIMIT`: batas cadangan, default `40`. Batas utama diatur HR di aplikasi.

## 2. Deploy Edge Function `ai`

1. **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Nama: `ai`.
3. Hapus isi contoh, lalu tempel seluruh isi file `supabase/functions/ai/index.ts`.
4. Klik **Deploy**.
5. Buka **Settings** fungsi `ai` dan **matikan "Verify JWT"**, seperti pada `send-email`.

Cara lain lewat CLI: `supabase functions deploy ai --no-verify-jwt`.

## 3. Aktifkan di aplikasi (akun HR)

1. Buka **Pengaturan** → kartu **Asisten AI (Gemini)**.
2. Ketuk **Tes Koneksi AI**. Harus muncul `Terhubung ✓ (model: …)`.
3. Ubah **Status** menjadi **Aktif untuk semua akun**, atur **Batas pemakaian / akun / hari**, lalu **Simpan**.

Setelah itu menu **Asisten AI** muncul untuk Staff, HOD, dan HR.

## Jika Tes Koneksi gagal

| Pesan | Penyebab dan solusi |
|---|---|
| Server AI belum di-deploy | Langkah 2 belum dilakukan, atau nama fungsinya bukan `ai`. |
| GEMINI_API_KEY belum di-set | Langkah 1 belum dilakukan. Setelah menambah secret, deploy ulang fungsinya. |
| API key Gemini ditolak | Key salah atau tidak aktif. Server mencoba tiga cara mengirim key: header `x-goog-api-key`, parameter `?key=`, dan endpoint Vertex express. Untuk key berawalan `AQ.` yang tetap ditolak, buat key baru di Google AI Studio. |
| Kuota gratis Gemini sedang habis | Batas free tier Google tercapai. Server sudah otomatis mencoba model cadangan (Flash lalu Flash-Lite). Tunggu beberapa saat. |

## Keamanan dan privasi

- Server hanya melayani akun yang terdaftar dan aktif di ABC Selaras.
- Ada dua batasan pemakaian: batas harian per akun (dicatat di `kv_store` dengan key `ai_usage`) dan maksimal 8 permintaan per menit.
- Data yang dikirim ke AI menyesuaikan peran:
  - **Staf:** hanya data dirinya sendiri.
  - **HOD:** data dirinya dan timnya.
  - **HR:** ringkasan seluruh perusahaan.
- **Gaji tidak dikirim.**
- Data yang dikirim lewat free tier Gemini dapat dipakai Google untuk meningkatkan layanannya. Jangan menulis data sangat rahasia di chat AI.
