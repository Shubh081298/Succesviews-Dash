-- ============================================================
-- Design Management module (Phase 1) — client design projects.
-- Additive & safe. Run in Supabase → SQL Editor.
-- ============================================================

create table if not exists public.design_projects (
  id                     uuid primary key default gen_random_uuid(),
  client_name            text not null,
  company_name           text,
  magazine_name          text,
  edition                text,
  due_date               date,
  priority               text default 'Medium',   -- High | Medium | Low
  assigned_designer      text,                     -- employee id
  assigned_designer_name text,                     -- denormalized for display
  status                 text default 'Pending',   -- Pending | Draft Started | Sample Ready | Revision Required | Final Design Ready | Completed
  instructions           text,                     -- instructions shown to the designer
  internal_notes         text,                     -- admin-only notes
  created_at             timestamptz default now(),
  updated_at             timestamptz default now()
);

create index if not exists idx_design_projects_status on public.design_projects (status);
create index if not exists idx_design_projects_due    on public.design_projects (due_date);

grant all on public.design_projects to anon, authenticated;
notify pgrst, 'reload schema';
