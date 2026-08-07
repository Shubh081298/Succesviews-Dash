-- Payroll Cycle — per-month payroll records for the Salary module.
-- Safe / additive. Run once in the Supabase SQL editor.
-- (The app is resilient: month drafts persist to this column when present,
--  and fall back to local storage until it is added — nothing breaks either way.)
alter table public.salaries add column if not exists months jsonb default '{}'::jsonb;
