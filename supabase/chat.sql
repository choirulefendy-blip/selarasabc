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
-- Kirim berkas (PDF, dokumen, dll.)
alter table chat_messages add column if not exists file_key text;
alter table chat_messages add column if not exists file_url text;
alter table chat_messages add column if not exists file_name text;
alter table chat_messages add column if not exists file_type text;
alter table chat_messages add column if not exists file_size bigint;

-- Batas isi pesan: boleh kosong (pesan foto / penanda hapus), maksimal 1000 karakter
alter table chat_messages drop constraint if exists chat_messages_body_check;
alter table chat_messages drop constraint if exists chat_messages_body_len;
alter table chat_messages add constraint chat_messages_body_len check (char_length(body) <= 1000);
alter table chat_messages drop constraint if exists chat_messages_kind_ok;
alter table chat_messages add constraint chat_messages_kind_ok check (kind in ('msg','task','del','sys'));

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


-- ============================================================
-- Chat v3: tanda dibaca, status online, sematkan & arsip (lintas perangkat)
-- ============================================================
create table if not exists chat_reads (
  reader text not null,          -- yang membaca ('hr' / ID karyawan)
  conv text not null,            -- lawan bicara (chat pribadi) atau 'g:<id grup>'
  last_id bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (reader, conv)
);
create index if not exists chat_reads_conv_idx on chat_reads (conv);
alter table chat_reads enable row level security;
drop policy if exists "chat_reads_all_anon" on chat_reads;
create policy "chat_reads_all_anon" on chat_reads for all using (true) with check (true);

create table if not exists chat_presence (
  uid text primary key,
  last_seen timestamptz not null default now()
);
alter table chat_presence enable row level security;
drop policy if exists "chat_presence_all_anon" on chat_presence;
create policy "chat_presence_all_anon" on chat_presence for all using (true) with check (true);

create table if not exists chat_prefs (
  uid text primary key,
  prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table chat_prefs enable row level security;
drop policy if exists "chat_prefs_all_anon" on chat_prefs;
create policy "chat_prefs_all_anon" on chat_prefs for all using (true) with check (true);
