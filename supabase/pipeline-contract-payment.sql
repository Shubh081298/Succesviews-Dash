-- ============================================================
-- Pipeline v2 — Contract Order + Payment Received workflow.
-- Run once in Supabase → SQL Editor. Safe / additive: adds columns to the
-- EXISTING pipeline_clients table (reusing the existing client + employee
-- relationships). No table is dropped; the old follow-up child tables
-- (pipeline_followups/contracts/sales/payments) are left in place for data
-- preservation but are no longer used by the app.
--
-- New per-client model:
--   Client → Contract Order (sent? file, date, amount, currency, status)
--         → Signed  ⇒ counts as Sales
--         → Payment Received (amount, currency, date, status)
--         → Paid    ⇒ counts as Payment Received
-- One contract + one payment per client ⇒ no double counting.
-- ============================================================

alter table public.pipeline_clients
  -- Contract Order
  add column if not exists contract_sent       boolean not null default false,
  add column if not exists contract_file_url   text,
  add column if not exists contract_file_name  text,
  add column if not exists contract_sent_date  date,
  add column if not exists contract_amount     numeric(14,2),
  add column if not exists contract_currency   text,
  add column if not exists contract_status     text,        -- 'Contract Sent' | 'Signed' | 'Not Signed'
  -- Payment Received
  add column if not exists payment_received     boolean not null default false,
  add column if not exists payment_amount       numeric(14,2),
  add column if not exists payment_currency     text,
  add column if not exists payment_date         date,
  add column if not exists payment_status       text;       -- 'Pending' | 'Paid'

-- Fast Overview aggregation: signed contracts (Sales) and paid payments (Payment Received).
create index if not exists idx_pclients_contract_status on public.pipeline_clients (contract_status);
create index if not exists idx_pclients_payment_status  on public.pipeline_clients (payment_status);

grant all on public.pipeline_clients to anon, authenticated;
