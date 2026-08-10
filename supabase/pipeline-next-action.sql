-- ============================================================
-- Pipeline "Next Action" task model — additive, safe.
-- Run once in Supabase → SQL Editor → Run. Safe to re-run.
-- The app already degrades gracefully if these columns are absent,
-- so nothing breaks before or after running this.
-- ============================================================

-- The client's current pending "next action" (what to do next).
alter table public.pipeline_clients
  add column if not exists next_action_type text;

-- Each follow-up records the action performed + its outcome.
alter table public.pipeline_followups
  add column if not exists action_type text,
  add column if not exists outcome     text;
