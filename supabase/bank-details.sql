-- ============================================================
-- Bank Details — per-employee banking information
-- Run once in the Supabase SQL editor. Safe / additive (no existing
-- table is touched). The app degrades gracefully until this exists.
-- ============================================================
create table if not exists public.bank_details (
  emp_id         text primary key references public.employees(id) on delete cascade,
  recipient_name text,
  account_number text,
  ifsc_code      text,
  upi_id         text,
  updated_at     timestamptz default now()
);

-- Permissive RLS to match the app's current anon-key access model.
-- NOTE for the future RLS cutover: replace this with
--   using (public.is_admin() or emp_id = public.current_emp_id())
alter table public.bank_details enable row level security;
drop policy if exists bank_details_all on public.bank_details;
create policy bank_details_all on public.bank_details for all using (true) with check (true);
