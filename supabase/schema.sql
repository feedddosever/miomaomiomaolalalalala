-- Run this once in your Supabase project's SQL editor.
-- (Dashboard -> SQL Editor -> New query -> paste -> Run)

create table if not exists daily_content (
  date date primary key,
  quests jsonb not null default '[]'::jsonb,
  bonus_type text not null check (bonus_type in ('recipe', 'instagram')),
  bonus jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists collected_treasures (
  date date primary key,
  quests jsonb not null default '[]'::jsonb,
  bonus_type text not null,
  bonus jsonb not null default '{}'::jsonb,
  opened_at timestamptz not null default now()
);

alter table daily_content enable row level security;
alter table collected_treasures enable row level security;

-- This app has a single user and talks to Supabase straight from the
-- browser with the public "anon" key, so the simplest policy is "anyone
-- with this key can read/write." That's fine for a personal hobby app,
-- but remember it means anyone who finds your deployed URL and reads the
-- key from the page could also write to these tables. Don't put anything
-- sensitive in them, and see the README for a slightly stronger option.

create policy "anon full access - daily_content"
  on daily_content for all
  using (true)
  with check (true);

create policy "anon full access - collected_treasures"
  on collected_treasures for all
  using (true)
  with check (true);
