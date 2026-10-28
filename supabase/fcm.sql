-- ============================================================
-- ABC Selaras — Tabel token FCM (notifikasi Android saat app tertutup)
-- ============================================================
-- Jalankan di Supabase: SQL Editor > New query > tempel > Run.
-- Aman dijalankan berkali-kali.
--
-- Token HP disimpan lewat fungsi (RPC) saja; tabelnya sendiri tertutup
-- untuk kunci "anon", jadi token tidak bisa dibaca lewat API publik.
-- Edge Function "send-push" membacanya memakai service role.
-- ============================================================

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
