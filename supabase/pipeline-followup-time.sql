-- ============================================================
-- Pipeline: add "Next Follow-up TIME" to clients (ADDITIVE, safe).
-- The app already works without this column (it retries the write
-- without the time), but running this lets the scheduled time persist
-- and show on both the Employee and Admin sides.
-- Re-runnable: IF NOT EXISTS.
-- ============================================================

alter table if exists public.pipeline_clients
  add column if not exists next_follow_up_time text;

-- Optional: store the time of each follow-up's *next* appointment too.
alter table if exists public.pipeline_followups
  add column if not exists next_follow_up_time text;
