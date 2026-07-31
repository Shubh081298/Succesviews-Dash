-- ============================================================
-- Pipeline: expected deal value for partial-payment tracking (B1).
-- ADDITIVE, safe, re-runnable. The app works without it (it retries the
-- write without these columns); running it lets partial payments track
-- against the agreed amount and persist across sessions.
-- ============================================================
alter table if exists public.pipeline_clients
  add column if not exists expected_amount   numeric,
  add column if not exists expected_currency text;
