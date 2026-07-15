-- ============================================================
-- Performance: indexes on frequently-filtered columns.
-- Safe & additive (IF NOT EXISTS). Run in Supabase → SQL Editor.
-- ============================================================

create index if not exists idx_submissions_emp_date on public.submissions (emp_id, date);
create index if not exists idx_submissions_date      on public.submissions (date);
create index if not exists idx_submissions_status    on public.submissions (status);
create index if not exists idx_salaries_emp          on public.salaries (emp_id);
create index if not exists idx_leaves_emp            on public.leaves (emp_id);
create index if not exists idx_leaves_status         on public.leaves (status);
create index if not exists idx_messages_emp          on public.messages (emp_id);
create index if not exists idx_employees_email       on public.employees (lower(email));

-- Foreign keys: add AFTER confirming there are no orphaned rows, e.g.
--   select emp_id from submissions where emp_id not in (select id from employees);
-- Then (NOT VALID enforces new rows without failing on legacy data):
--   alter table public.submissions add constraint fk_sub_emp
--     foreign key (emp_id) references public.employees(id) on delete cascade not valid;
