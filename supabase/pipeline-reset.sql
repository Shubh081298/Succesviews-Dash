-- ============================================================
-- PIPELINE FULL RESET — permanently removes ALL existing clients
-- and every related follow-up, contract, sale, payment, note and
-- history record. Run this ONCE in the Supabase SQL editor.
-- This cannot be undone. Old records will not reappear after refresh/login.
-- ============================================================

-- Child records first (they reference pipeline_clients).
delete from public.pipeline_history;
delete from public.pipeline_followups;
delete from public.pipeline_contracts;
delete from public.pipeline_sales;
delete from public.pipeline_payments;
delete from public.pipeline_notes;

-- Then the clients themselves.
delete from public.pipeline_clients;

-- Verify everything is empty (each count should return 0):
select
  (select count(*) from public.pipeline_clients)   as clients,
  (select count(*) from public.pipeline_history)    as history,
  (select count(*) from public.pipeline_followups)  as followups,
  (select count(*) from public.pipeline_contracts)  as contracts,
  (select count(*) from public.pipeline_sales)      as sales,
  (select count(*) from public.pipeline_payments)   as payments,
  (select count(*) from public.pipeline_notes)      as notes;
