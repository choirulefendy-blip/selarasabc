-- ============================================================
-- ABC Selaras — Tabel langganan Web Push (iPhone / browser)
-- Jalankan di Supabase: SQL Editor > New query > tempel > Run.
-- Aman dijalankan berkali-kali.
-- ============================================================
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  recipient text not null,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_recipient_idx on push_subscriptions (recipient);

alter table push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_select_anon" on push_subscriptions;
create policy "push_subscriptions_select_anon" on push_subscriptions for select using (true);

drop policy if exists "push_subscriptions_insert_anon" on push_subscriptions;
create policy "push_subscriptions_insert_anon" on push_subscriptions for insert with check (true);
