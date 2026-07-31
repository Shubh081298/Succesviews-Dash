-- ============================================================
-- SECURITY 02 — Role-based Row Level Security  (⚠ STAGED — DO NOT RUN BLIND)
--
-- WHY THIS ISN'T LIVE YET
-- The app currently reaches Supabase with the PUBLIC anon key and:
--   • the Admin logs in with bcrypt against `settings` (NO Supabase session), and
--   • many employees log in via the `emp_login` RPC fallback (NO Supabase JWT).
-- If you enable auth.uid()-based RLS while those sessions have no JWT, the admin
-- portal and every RPC-fallback employee are INSTANTLY locked out of the live DB.
--
-- PREREQUISITES (the "auth cutover") — do these first, verify, THEN run this file:
--   1. Every employee exists in Supabase Auth (auth.users) — provision via the
--      admin-users Edge Function; make login use employeeSignIn ONLY (retire the
--      emp_login fallback, or keep it read-only behind a service role).
--   2. The Admin is a real Supabase Auth user too (not the bcrypt settings row).
--   3. Backfill employees.auth_id (below) and set employees.role = 'admin' for admins.
--   4. Confirm both portals still load with the JWT before applying the policies.
-- Roll out on a staging copy first.
-- ============================================================

-- ---- Columns: link app employees to auth users + a role ----
alter table public.employees add column if not exists auth_id uuid references auth.users(id);
alter table public.employees add column if not exists role   text not null default 'employee';
create index if not exists idx_employees_auth on public.employees(auth_id);

-- Backfill example (run once, after auth users exist, matched by email):
--   update public.employees e set auth_id = u.id
--   from auth.users u where lower(u.email) = lower(e.email) and e.auth_id is null;
--   update public.employees set role = 'admin' where email = 'YOUR_ADMIN_EMAIL';

-- ---- Helper functions (SECURITY DEFINER so policies can call them) ----
create or replace function public.current_emp_id() returns text
language sql stable security definer set search_path = public as $$
  select id from public.employees where auth_id = auth.uid() limit 1
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.employees where auth_id = auth.uid() and role = 'admin')
$$;

-- ---- Pipeline: clients (owner or admin) ----
alter table public.pipeline_clients enable row level security;
drop policy if exists pipeline_clients_all on public.pipeline_clients;   -- remove the permissive policy
drop policy if exists pc_select on public.pipeline_clients;
drop policy if exists pc_write  on public.pipeline_clients;
create policy pc_select on public.pipeline_clients for select
  using (public.is_admin() or employee_id = public.current_emp_id());
create policy pc_write on public.pipeline_clients for all
  using (public.is_admin() or employee_id = public.current_emp_id())
  with check (public.is_admin() or employee_id = public.current_emp_id());

-- ---- Pipeline child tables: owner (via employee_id) or admin ----
do $$
declare t text;
begin
  foreach t in array array[
    'pipeline_followups','pipeline_sales','pipeline_payments',
    'pipeline_contracts','pipeline_notes','pipeline_history'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t||'_all', t);
    execute format('drop policy if exists %I on public.%I', t||'_rw', t);
    -- child rows carry employee_id for the acting employee; sales/payments/contracts
    -- may not, so also allow rows whose client belongs to the current employee.
    execute format($p$
      create policy %1$s_rw on public.%1$I for all
      using (
        public.is_admin()
        or coalesce(employee_id, '') = public.current_emp_id()
        or exists (select 1 from public.pipeline_clients c
                   where c.id = %1$I.client_id and c.employee_id = public.current_emp_id())
      )
      with check (
        public.is_admin()
        or coalesce(employee_id, '') = public.current_emp_id()
        or exists (select 1 from public.pipeline_clients c
                   where c.id = %1$I.client_id and c.employee_id = public.current_emp_id())
      )$p$, t);
  end loop;
end $$;

-- ---- Daily reports: own rows or admin ----
alter table public.submissions enable row level security;
drop policy if exists submissions_all on public.submissions;
create policy sub_rw on public.submissions for all
  using (public.is_admin() or emp_id = public.current_emp_id())
  with check (public.is_admin() or emp_id = public.current_emp_id());

-- ---- Admin-only tables (employees may read only their own salary/payslip) ----
-- salaries, expenses, settings, insertion orders, design_work etc.:
--   create policy admin_only on public.<table> for all
--     using (public.is_admin()) with check (public.is_admin());
-- Employee self-read where relevant, e.g. salaries:
--   create policy salary_self_read on public.salaries for select
--     using (public.is_admin() or emp_id = public.current_emp_id());

-- ---- Masters: everyone signed-in reads, admin writes ----
do $$
declare t text;
begin
  foreach t in array array['domains','pipeline_status_master'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t||'_all', t);
    execute format('create policy %I on public.%I for select using (auth.role() = ''authenticated'')', t||'_read', t);
    execute format('create policy %I on public.%I for all using (public.is_admin()) with check (public.is_admin())', t||'_write', t);
  end loop;
end $$;

-- After running: sign in as an employee AND as the admin and confirm each portal
-- still reads/writes exactly the rows it should — nothing more.
