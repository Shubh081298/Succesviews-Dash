-- ============================================================
-- Design module — Web Push subscriptions (real push notifications).
-- One row per registered device/browser. Run once in Supabase → SQL Editor.
-- Safe / additive. Follows this app's convention (RLS disabled, granted to anon).
-- ============================================================
create table if not exists public.design_push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,            -- "admin" or a designer's employee id
  role         text,                     -- "admin" | "designer"
  endpoint     text not null,            -- push endpoint URL (unique per device)
  subscription jsonb not null,           -- full PushSubscription JSON (keys, endpoint…)
  user_agent   text,                     -- device/browser hint (for the user to recognise it)
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  last_used_at timestamptz
);

-- One subscription per endpoint; re-subscribing on the same device updates the row.
create unique index if not exists uq_dps_endpoint on public.design_push_subscriptions (endpoint);
create index if not exists idx_dps_user on public.design_push_subscriptions (user_id);

alter table public.design_push_subscriptions disable row level security;
grant all on public.design_push_subscriptions to anon, authenticated;
