-- ============================================================
-- Expense (Contract Payments) module — additive table.
-- Run in Supabase → SQL Editor. Matches the current open-access
-- setup of the other tables (anon + authenticated). Safe & additive.
-- ============================================================

create table if not exists public.expenses (
  id             uuid primary key default gen_random_uuid(),
  contract_order text,                     -- Contract Order (number/reference)
  client_name    text not null,            -- Client / Contract Name
  payment_date   date,                     -- Payment Received Date
  amount         numeric(14,2),            -- Amount Received (original currency)
  currency       text default 'INR',       -- INR, USD, AED, AUD, EUR, ...
  bank_amount    numeric(14,2),            -- Actual amount credited in bank (net)
  bank_currency  text default 'INR',       -- Currency actually received in bank
  payment_method text,                     -- PayPal, Skydo, Bank Transfer, ...
  notes          text,                     -- Notes / Remarks (optional)
  created_at     timestamptz default now()
);

create index if not exists idx_expenses_payment_date on public.expenses (payment_date);
create index if not exists idx_expenses_client_name  on public.expenses (lower(client_name));

grant all on public.expenses to anon, authenticated;
