-- ============================================================
-- PERF 01 — Indexes for the query patterns the app runs (P1).
-- Additive, safe, re-runnable. Speeds up dedupe, login, and reporting
-- at scale. (The pipeline_* child tables are already indexed by client_id.)
-- ============================================================

-- Duplicate-lead check filters on (client_email, domain_name)
create index if not exists idx_pc_email_domain_name
  on public.pipeline_clients (lower(client_email), domain_name)
  where is_deleted = false;

-- Employee login / auth linkage
create index if not exists idx_employees_email on public.employees (lower(email));
create index if not exists idx_employees_auth  on public.employees (auth_id);

-- Reports / leaderboard filter submissions by employee + date
create index if not exists idx_sub_emp_date on public.submissions (emp_id, date);
create index if not exists idx_sub_date      on public.submissions (date);
