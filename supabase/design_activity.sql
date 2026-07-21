-- ============================================================
-- Design Management Phase 4 — activity timeline + revision history.
-- One append-only log per project (never deleted). Applied live.
-- ============================================================

create table if not exists public.design_activity (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references public.design_projects(id) on delete cascade,
  type        text,        -- created | status | upload | revision | note
  actor_role  text,        -- admin | designer
  actor_name  text,
  comment     text,        -- revision comment / note text
  meta        text,        -- e.g. new status, file "kind vN"
  created_at  timestamptz default now()
);
create index if not exists idx_design_activity_project on public.design_activity (project_id);
grant all on public.design_activity to anon, authenticated;
notify pgrst, 'reload schema';
