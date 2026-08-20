-- ============================================================
-- Employee termination / deactivation (soft, reversible).
-- Run once in Supabase → SQL Editor. Safe / additive — no data is deleted.
-- Follows this app's convention (RLS disabled, granted to anon).
--
-- A terminated employee:
--   • keeps ALL their data, submissions, salary and history (nothing removed);
--   • drops out of live/active counts, current rosters and new-work selectors;
--   • can no longer sign in (blocked client-side in the Employee Portal);
--   • is moved to the "Former Employees" section (view-only history + Reactivate).
-- Reactivating simply flips status back to 'active' and clears the timestamps.
-- ============================================================

alter table public.employees
  add column if not exists status            text not null default 'active',  -- 'active' | 'terminated'
  add column if not exists terminated_at     timestamptz,
  add column if not exists terminated_reason text,
  add column if not exists terminated_by     text;

-- Any pre-existing rows are active by default (the column default handles it),
-- but make it explicit for rows created before this migration.
update public.employees set status = 'active' where status is null;

-- Fast filtering of active vs former employees.
create index if not exists idx_employees_status on public.employees (status);

-- Keep the app's convention (RLS disabled + granted) intact for the new columns.
grant all on public.employees to anon, authenticated;
