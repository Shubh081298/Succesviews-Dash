-- ============================================================
-- Pipeline: add "Project Name" to clients (ADDITIVE, safe).
-- The app works without this (it retries the write without the
-- column), but running this lets Project Name persist and show
-- in the Admin table + lead screens. Re-runnable: IF NOT EXISTS.
-- ============================================================

alter table if exists public.pipeline_clients
  add column if not exists project_name text;
