-- ============================================================
-- Expense module v2 — unified financial ledger.
-- Run this whole block in Supabase → SQL Editor, then hit Run.
-- (Adds columns for the 3 record types + fixes the RLS block you hit.)
-- ============================================================

-- 1) Fix the "row-level security policy" error: match the other tables
--    (RLS currently off app-wide; admin uses the anon key, no auth session).
alter table public.expenses disable row level security;

-- 2) Unified ledger columns (safe / additive).
alter table public.expenses
  add column if not exists type           text default 'company',   -- insertion_order | salary | company
  add column if not exists source_key     text,                     -- dedupe key for auto-capture
  add column if not exists title          text,
  add column if not exists category       text,
  add column if not exists payment_status text,
  add column if not exists details        jsonb default '{}'::jsonb;

-- 3) One record per order / per salary month (upsert target).
create unique index if not exists uq_expenses_source_key on public.expenses (source_key);

grant all on public.expenses to anon, authenticated;
