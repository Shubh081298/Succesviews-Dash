-- ============================================================
-- Admin attendance overrides — manual attendance edits + audit.
-- Run once in Supabase → SQL Editor → Run. Safe / additive.
-- One row per employee + date (upsert); keeps previous status + who/when.
-- ============================================================
create table if not exists public.attendance_overrides (
  id          uuid primary key default gen_random_uuid(),
  emp_id      text not null,
  date        date not null,
  status      text not null,          -- Present | Half Day | Leave | Absent | Holiday
  remark      text,
  prev_status text,
  updated_by  text,
  updated_at  timestamptz default now(),
  created_at  timestamptz default now()
);

create unique index if not exists uq_att_override_emp_date on public.attendance_overrides (emp_id, date);

alter table public.attendance_overrides disable row level security;
grant all on public.attendance_overrides to anon, authenticated;
