# Google Calendar (link langganan iCal)

Setiap karyawan bisa menampilkan jadwal shift, libur/cuti/sakit/izin, cuti disetujui,
tenggat tugas Selaras Board, dan agenda di Google Calendar dari **Profil → Google Calendar**.

## Deploy sekali (admin)
1. Supabase → **Edge Functions → Deploy a new function** → nama `calendar-ics`.
2. Tempel isi `supabase/functions/calendar-ics/index.ts`, lalu **Deploy**.
3. Buka fungsi `calendar-ics` → **Details/Settings** → matikan **Verify JWT** (Enforce JWT verification) → Save.
   (Google Calendar tidak bisa mengirim header login; keamanan memakai token acak per karyawan.)
   Via CLI: `supabase functions deploy calendar-ics --no-verify-jwt`

## Cara pakai (karyawan)
Profil → Google Calendar → **Sambungkan** → **Tambahkan ke Google Calendar** → Tambahkan.
Google memperbarui kalender langganan berkala (biasanya beberapa jam). Link bisa di-reset bila bocor.
