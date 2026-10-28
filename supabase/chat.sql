-- ============================================================
-- ABC Selaras — Tabel Chat
-- ============================================================
-- Jalankan di Supabase: SQL Editor > New query > tempel > Run.
-- Aman dijalankan berkali-kali, dan AMAN untuk tabel chat yang sudah ada
-- (menambah kolom untuk foto, pesan tugas, dan hapus pesan).
-- Tanpa tabel ini, menu Chat menampilkan "Fitur chat belum aktif di server".
-- ============================================================

create table if not exists chat_messages (
  id bigint generated always as identity primary key,
  sender text not null,       -- 'hr' atau ID karyawan
  recipient text not null,    -- 'hr' atau ID karyawan
  body text not null default '',
  created_at timestamptz not null default now()
);

-- Kolom tambahan (foto, jenis pesan, penanda hapus)
alter table chat_messages add column if not exists kind text not null default 'msg';  -- 'msg' | 'task' | 'del'
alter table chat_messages add column if not exists ref_id bigint;                      -- untuk 'del': id pesan yang dihapus
alter table chat_messages add column if not exists image_key text;
alter table chat_messages add column if not exists image_url text;

-- Batas isi pesan: boleh kosong (pesan foto / penanda hapus), maksimal 1000 karakter
alter table chat_messages drop constraint if exists chat_messages_body_check;
alter table chat_messages drop constraint if exists chat_messages_body_len;
alter table chat_messages add constraint chat_messages_body_len check (char_length(body) <= 1000);
alter table chat_messages drop constraint if exists chat_messages_kind_ok;
alter table chat_messages add constraint chat_messages_kind_ok check (kind in ('msg','task','del'));

create index if not exists chat_messages_sender_idx on chat_messages (sender, id);
create index if not exists chat_messages_recipient_idx on chat_messages (recipient, id);

alter table chat_messages enable row level security;

-- Hanya boleh membaca & menambah baris (tidak ada ubah/hapus lewat API).
-- "Hapus pesan" dilakukan dengan menambah baris penanda (kind = 'del'), jadi riwayat tetap append-only.
-- CATATAN KEAMANAN: sama seperti tabel lain di aplikasi ini, login aplikasi
-- bukan Supabase Auth, jadi kunci "anon" yang ada di front-end secara teknis
-- bisa membaca semua pesan lewat API. Pemisahan "siapa lihat chat siapa"
-- hanya dilakukan oleh aplikasi. Jangan kirim data sangat rahasia lewat chat.
drop policy if exists "chat_messages_select_anon" on chat_messages;
create policy "chat_messages_select_anon" on chat_messages for select using (true);

drop policy if exists "chat_messages_insert_anon" on chat_messages;
create policy "chat_messages_insert_anon" on chat_messages for insert with check (true);
