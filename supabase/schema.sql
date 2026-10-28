-- ============================================================
-- ABC Selaras — Setup Supabase
-- ============================================================
-- Jalankan seluruh isi file ini di Supabase: buka project kamu
-- di supabase.com > SQL Editor > New query > tempel semua ini >
-- klik Run. Aman dijalankan berkali-kali (pakai "if not exists").
-- ============================================================

-- 1) Tabel penyimpanan utama (menyimpan seluruh data aplikasi
--    sebagai satu blok JSON di bawah key 'hrdb', persis seperti
--    cara kerja penyimpanan bawaan Claude sebelumnya).
create table if not exists kv_store (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

alter table kv_store enable row level security;

-- Kebijakan akses: aplikasi ini punya sistem login sendiri (HR/HOD/
-- Staff) yang terpisah dari fitur Auth bawaan Supabase, jadi di sini
-- kita izinkan kunci "anon" (dipakai front-end) untuk baca/tulis.
-- CATATAN KEAMANAN: kunci anon ada di source code front-end (bisa
-- dilihat siapa saja yang membuka situsnya), jadi siapa pun yang
-- punya kunci itu bisa membaca/menulis tabel ini langsung lewat API
-- Supabase, di luar aplikasi. Jangan simpan data selain data HR biasa
-- di tabel ini, dan jangan pernah taruh kunci "service_role" di
-- front-end.
drop policy if exists "kv_store_select_anon" on kv_store;
create policy "kv_store_select_anon" on kv_store for select using (true);

drop policy if exists "kv_store_insert_anon" on kv_store;
create policy "kv_store_insert_anon" on kv_store for insert with check (true);

drop policy if exists "kv_store_update_anon" on kv_store;
create policy "kv_store_update_anon" on kv_store for update using (true);

-- 2) Bucket Storage untuk foto absen & lampiran Form & Approval.
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

drop policy if exists "attachments_insert_anon" on storage.objects;
create policy "attachments_insert_anon"
on storage.objects for insert
with check (bucket_id = 'attachments');

drop policy if exists "attachments_select_public" on storage.objects;
create policy "attachments_select_public"
on storage.objects for select
using (bucket_id = 'attachments');

-- 3) Tabel penyimpanan langganan Push Notification (dipakai fitur
--    notifikasi ke perangkat). Satu baris per perangkat yang
--    mengaktifkan notifikasi; "recipient" berisi 'hr' atau ID
--    karyawan (empId), boleh lebih dari satu baris per recipient
--    kalau mereka login dari beberapa perangkat.
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  recipient text not null,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_select_anon" on push_subscriptions;
create policy "push_subscriptions_select_anon" on push_subscriptions for select using (true);

drop policy if exists "push_subscriptions_insert_anon" on push_subscriptions;
create policy "push_subscriptions_insert_anon" on push_subscriptions for insert with check (true);

-- 4) Tabel Chat (lihat juga supabase/chat.sql yang isinya sama).
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

-- 5) Token FCM untuk notifikasi Android (lihat juga supabase/fcm.sql).
create table if not exists fcm_tokens (
  token text primary key,
  recipient text not null,          -- 'hr' atau ID karyawan
  platform text not null default 'android',
  updated_at timestamptz not null default now()
);
create index if not exists fcm_tokens_recipient_idx on fcm_tokens (recipient);

alter table fcm_tokens enable row level security;   -- tanpa policy = anon tidak bisa akses langsung

create or replace function register_fcm_token(p_token text, p_recipient text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_token is null or length(p_token) < 20 or length(p_token) > 4096
     or p_recipient is null or length(p_recipient) = 0 or length(p_recipient) > 100 then
    raise exception 'parameter tidak valid';
  end if;
  insert into fcm_tokens (token, recipient, updated_at)
  values (p_token, p_recipient, now())
  on conflict (token) do update set recipient = excluded.recipient, updated_at = now();
end $$;

create or replace function unregister_fcm_token(p_token text)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from fcm_tokens where token = p_token;
end $$;

revoke all on function register_fcm_token(text, text) from public;
revoke all on function unregister_fcm_token(text) from public;
grant execute on function register_fcm_token(text, text) to anon, authenticated;
grant execute on function unregister_fcm_token(text) to anon, authenticated;

-- Selesai. Lihat README bagian "Setup Supabase" untuk langkah
-- berikutnya: ambil Project URL & anon key, tempel ke index.html.
