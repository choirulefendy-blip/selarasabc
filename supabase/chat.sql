-- ============================================================
-- ABC Selaras — Tabel Chat
-- ============================================================
-- Jalankan di Supabase: SQL Editor > New query > tempel > Run.
-- Aman dijalankan berkali-kali. Tanpa tabel ini, menu Chat akan
-- menampilkan pesan "Fitur chat belum aktif di server".
-- ============================================================

create table if not exists chat_messages (
  id bigint generated always as identity primary key,
  sender text not null,       -- 'hr' atau ID karyawan
  recipient text not null,    -- 'hr' atau ID karyawan
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_sender_idx on chat_messages (sender, id);
create index if not exists chat_messages_recipient_idx on chat_messages (recipient, id);

alter table chat_messages enable row level security;

-- Hanya boleh membaca & menambah pesan (tidak ada ubah/hapus lewat API).
-- CATATAN KEAMANAN: sama seperti tabel lain di aplikasi ini, login aplikasi
-- bukan Supabase Auth, jadi kunci "anon" yang ada di front-end secara teknis
-- bisa membaca semua pesan lewat API. Pemisahan "siapa lihat chat siapa"
-- hanya dilakukan oleh aplikasi. Jangan kirim data sangat rahasia lewat chat.
drop policy if exists "chat_messages_select_anon" on chat_messages;
create policy "chat_messages_select_anon" on chat_messages for select using (true);

drop policy if exists "chat_messages_insert_anon" on chat_messages;
create policy "chat_messages_insert_anon" on chat_messages for insert with check (true);
