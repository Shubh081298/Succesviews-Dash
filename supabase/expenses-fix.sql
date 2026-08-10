-- ============================================================
-- Expense module — one-shot idempotent fix.
-- Run this WHOLE block once in Supabase → SQL Editor → Run.
-- Safe to re-run. Fixes "nothing shows in Expense" by making sure the
-- table, all v2 columns, the dedupe index, RLS and grants all exist —
-- so auto-capture (salary release, freelancer pay, insertion orders)
-- stops failing silently.
-- ============================================================

-- 1) Base table (created only if missing).
create table if not exists public.expenses (
  id             uuid primary key default gen_random_uuid(),
  contract_order text,
  client_name    text,
  payment_date   date,
  amount         numeric(14,2),
  currency       text default 'INR',
  bank_amount    numeric(14,2),
  bank_currency  text default 'INR',
  payment_method text,
  notes          text,
  created_at     timestamptz default now()
);

-- 2) v2 / unified-ledger columns (additive, safe).
alter table public.expenses
  add column if not exists type           text default 'company',   -- insertion_order | salary | company
  add column if not exists source_key     text,                     -- dedupe key for auto-capture
  add column if not exists title          text,
  add column if not exists category       text,
  add column if not exists payment_status text,
  add column if not exists details        jsonb default '{}'::jsonb;

-- 3) client_name must allow NULL (older schema had NOT NULL; captures may omit it).
alter table public.expenses alter column client_name drop not null;

-- 4) Dedupe target so upsert on source_key works (one row per salary-month / order).
create unique index if not exists uq_expenses_source_key on public.expenses (source_key);
create index if not exists idx_expenses_payment_date on public.expenses (payment_date);

-- 5) Match the rest of the app (anon key, no auth session): RLS off + grants.
alter table public.expenses disable row level security;
grant all on public.expenses to anon, authenticated;
