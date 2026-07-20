-- ============================================================
-- FIX: DSR save failed with
--   "Could not find the 'contract_orders_data' column of
--    'submissions' in the schema cache."
-- The employee DSR writes several detail fields as jsonb columns;
-- `contract_orders_data` (the "Contract Order Sent" field) was never
-- created in the database. This adds all of them idempotently.
-- Applied live to the production project on the day of the incident.
-- ============================================================

alter table public.submissions
  add column if not exists websites_data        jsonb default '[]'::jsonb,
  add column if not exists leads_data           jsonb default '[]'::jsonb,
  add column if not exists followups_data       jsonb default '[]'::jsonb,
  add column if not exists calls_data           jsonb default '[]'::jsonb,
  add column if not exists sales_data           jsonb default '[]'::jsonb,
  add column if not exists payments_data        jsonb default '[]'::jsonb,
  add column if not exists contract_orders_data jsonb default '[]'::jsonb;

-- Tell PostgREST to refresh its schema cache immediately.
notify pgrst, 'reload schema';
