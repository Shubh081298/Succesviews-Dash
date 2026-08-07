-- ============================================================================
-- PHASE 1 — Security & Stability hardening  (SAFE / ADDITIVE / IDEMPOTENT)
--
-- Everything here is backward-compatible and will NOT break the running app:
--   • indexes use IF NOT EXISTS
--   • foreign keys are added NOT VALID (new writes are checked; existing rows
--     are never re-validated, so legacy/orphan data can't block the migration)
--   • CHECK constraints are added NOT VALID (same reasoning)
--   • new columns use ADD COLUMN IF NOT EXISTS
--   • the audit_log table is CREATE TABLE IF NOT EXISTS
--
-- It deliberately does NOT enable enforcing auth.uid() RLS — that requires the
-- auth cutover (admin + employees on Supabase Auth) and would lock the current
-- bcrypt-admin session out of the database. That step is staged separately in
-- security-02-rolebased-rls.sql and must be applied only AFTER the cutover.
--
-- Run this whole file once in the Supabase SQL editor.
-- ============================================================================

-- ── 12/22. Indexes on frequently queried columns ───────────────────────────
create index if not exists idx_submissions_emp_date   on public.submissions (emp_id, date);
create index if not exists idx_submissions_date        on public.submissions (date);
create index if not exists idx_submissions_status      on public.submissions (status);
create index if not exists idx_leaves_emp              on public.leaves (emp_id);
create index if not exists idx_leaves_status           on public.leaves (status);
create index if not exists idx_salaries_emp            on public.salaries (emp_id);
create index if not exists idx_bank_details_emp        on public.bank_details (emp_id);
create index if not exists idx_expenses_type           on public.expenses (type);
create index if not exists idx_pclients_emp            on public.pipeline_clients (employee_id);
create index if not exists idx_pclients_deleted        on public.pipeline_clients (is_deleted);
create index if not exists idx_pfollowups_client       on public.pipeline_followups (client_id);
create index if not exists idx_psales_client           on public.pipeline_sales (client_id);
create index if not exists idx_ppayments_client        on public.pipeline_payments (client_id);
create index if not exists idx_pcontracts_client       on public.pipeline_contracts (client_id);
create index if not exists idx_pnotes_client           on public.pipeline_notes (client_id);
create index if not exists idx_phistory_client         on public.pipeline_history (client_id);
create index if not exists idx_design_projects_designer on public.design_projects (assigned_designer);
create index if not exists idx_employees_department    on public.employees (department);

-- ── 8. Foreign keys (NOT VALID — enforced on new writes, legacy rows exempt) ─
-- Wrapped so a missing table / already-present constraint can't abort the run.
do $$
declare
  fk record;
begin
  for fk in
    select * from (values
      ('pipeline_followups','client_id','pipeline_clients','id','fk_pfollowups_client'),
      ('pipeline_sales',    'client_id','pipeline_clients','id','fk_psales_client'),
      ('pipeline_payments', 'client_id','pipeline_clients','id','fk_ppayments_client'),
      ('pipeline_contracts','client_id','pipeline_clients','id','fk_pcontracts_client'),
      ('pipeline_notes',    'client_id','pipeline_clients','id','fk_pnotes_client'),
      ('pipeline_history',  'client_id','pipeline_clients','id','fk_phistory_client'),
      ('bank_details',      'emp_id',   'employees',       'id','fk_bank_emp'),
      ('salaries',          'emp_id',   'employees',       'id','fk_salaries_emp')
    ) as t(child, col, parent, pcol, cname)
  loop
    begin
      execute format(
        'alter table public.%I add constraint %I foreign key (%I) references public.%I(%I) on delete cascade not valid',
        fk.child, fk.cname, fk.col, fk.parent, fk.pcol);
    exception
      when duplicate_object then null;   -- already exists
      when undefined_table  then null;   -- table not present
      when others           then raise notice 'skip FK % : %', fk.cname, sqlerrm;
    end;
  end loop;
end $$;

-- ── 11. CHECK constraints for money (>= 0) — NOT VALID so legacy rows pass ───
do $$
declare c record;
begin
  for c in
    select * from (values
      ('salaries',          'fixed_salary',    'chk_salary_nonneg'),
      ('pipeline_sales',    'amount',          'chk_psale_nonneg'),
      ('pipeline_payments', 'amount',          'chk_ppay_nonneg'),
      ('expenses',          'amount',          'chk_expense_nonneg')
    ) as t(tbl, col, cname)
  loop
    begin
      execute format('alter table public.%I add constraint %I check (%I is null or %I >= 0) not valid',
        c.tbl, c.cname, c.col, c.col);
    exception
      when duplicate_object then null;
      when undefined_table  then null;
      when undefined_column then null;
      when others           then raise notice 'skip CHECK % : %', c.cname, sqlerrm;
    end;
  end loop;
end $$;

-- ── 21. Soft-delete columns (deleted_at / deleted_by) — additive ────────────
do $$
declare t text;
begin
  foreach t in array array['employees','pipeline_clients','design_projects','expenses','salaries'] loop
    begin
      execute format('alter table public.%I add column if not exists deleted_at timestamptz', t);
      execute format('alter table public.%I add column if not exists deleted_by text', t);
    exception when undefined_table then null; end;
  end loop;
end $$;

-- ── 20. Audit log table (login/logout/create/salary/dept/role/delete …) ─────
create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  actor_id    text,                         -- employee id / 'admin'
  actor_name  text,
  action      text not null,                -- e.g. 'login','salary.paid','employee.delete'
  entity      text,                         -- e.g. 'employee','salary','department'
  entity_id   text,
  details     jsonb default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_audit_created on public.audit_log (created_at desc);
create index if not exists idx_audit_action  on public.audit_log (action);
alter table public.audit_log enable row level security;
drop policy if exists audit_log_all on public.audit_log;
-- permissive for now (matches current anon-key model); tighten during the RLS cutover
create policy audit_log_all on public.audit_log for all using (true) with check (true);

-- ============================================================================
-- REVIEW-FIRST section — run each SELECT, and only add the constraint if it
-- returns 0 rows. These CAN fail on dirty data, so they are NOT auto-applied.
-- ============================================================================
-- Duplicate domains (blocks a UNIQUE index):
--   select lower(domain_name), count(*) from public.domains group by 1 having count(*) > 1;
-- If 0 rows:  create unique index if not exists uq_domains_name on public.domains (lower(domain_name));
--
-- Employees missing a name (blocks NOT NULL):
--   select count(*) from public.employees where name is null;
-- If 0:  alter table public.employees alter column name set not null;
-- ============================================================================
