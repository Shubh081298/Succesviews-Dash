-- ============================================================
-- PHASE 1 — SECURITY HARDENING (per-user RLS + real admin role)
-- ------------------------------------------------------------
-- ⚠️  DO NOT run this blind on the live project. It changes who can read/
--     write every table. Apply it in a controlled window (ideally on a
--     separate STAGING Supabase project first) and immediately verify:
--       1) admin can log in and see all data,
--       2) an employee can log in, submit a DSR, see only their own data,
--       3) an employee CANNOT read another employee's password.
--
-- Prerequisite CODE change (must ship together — see notes at bottom):
--   • Admin must authenticate via Supabase Auth (not the settings password),
--     so the admin's client carries a JWT. Otherwise RLS blocks the admin.
--   • Employee portal must read the colleague roster from `employees_public`
--     (below), and its own full row from `employees`.
-- ============================================================

-- 1) Who is an admin?  (Supabase Auth user ids listed here.)
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

-- Seed the current admin (the admin_email Supabase Auth account).
-- Replace the sub-select if the admin email differs.
insert into public.app_admins (user_id)
select id from auth.users where lower(email) = 'shubhamkadam517@gmail.com'
on conflict do nothing;

-- 2) is_admin(): security-definer so policies can call it safely.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.app_admins a where a.user_id = auth.uid());
$$;

-- 3) Colleague roster WITHOUT sensitive columns (name/dept/etc. only).
--    Employees read this for team-lead / colleague names.
create or replace view public.employees_public as
  select id, name, department, code, photo, team_lead
  from public.employees;
grant select on public.employees_public to authenticated;

-- 4) Enable RLS everywhere and add policies.
--    Pattern: admin (is_admin()) can do everything; employees are scoped to
--    their own rows via employees.auth_uid = auth.uid().

-- employees: own row (full) + admin all. password_plain is only visible on
-- your own row (your own password) or to the admin.
alter table public.employees enable row level security;
drop policy if exists emp_admin_all on public.employees;
create policy emp_admin_all on public.employees for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists emp_self_read on public.employees;
create policy emp_self_read on public.employees for select to authenticated
  using (auth_uid = auth.uid());
drop policy if exists emp_self_update on public.employees;
create policy emp_self_update on public.employees for update to authenticated
  using (auth_uid = auth.uid()) with check (auth_uid = auth.uid());

-- submissions: employee owns their rows; admin all.
alter table public.submissions enable row level security;
drop policy if exists sub_admin_all on public.submissions;
create policy sub_admin_all on public.submissions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists sub_self on public.submissions;
create policy sub_self on public.submissions for all to authenticated
  using (emp_id in (select id from public.employees where auth_uid = auth.uid()))
  with check (emp_id in (select id from public.employees where auth_uid = auth.uid()));

-- leaves: employee owns their rows; admin all.
alter table public.leaves enable row level security;
drop policy if exists lv_admin_all on public.leaves;
create policy lv_admin_all on public.leaves for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists lv_self on public.leaves;
create policy lv_self on public.leaves for all to authenticated
  using (emp_id in (select id from public.employees where auth_uid = auth.uid()))
  with check (emp_id in (select id from public.employees where auth_uid = auth.uid()));

-- messages: employee reads/updates (dismiss) their own; admin all.
alter table public.messages enable row level security;
drop policy if exists msg_admin_all on public.messages;
create policy msg_admin_all on public.messages for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists msg_self on public.messages;
create policy msg_self on public.messages for all to authenticated
  using (emp_id in (select id from public.employees where auth_uid = auth.uid()))
  with check (emp_id in (select id from public.employees where auth_uid = auth.uid()));

-- salaries: admin only (employees never read the salaries table directly;
-- they receive payslips via messages).
alter table public.salaries enable row level security;
drop policy if exists sal_admin_all on public.salaries;
create policy sal_admin_all on public.salaries for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Reference/config data readable by any signed-in user; writable by admin.
do $$
declare t text;
begin
  foreach t in array array['announcements','websites','custom_fields','departments','settings']
  loop
    execute format('alter table if exists public.%I enable row level security;', t);
    execute format('drop policy if exists cfg_read on public.%I;', t);
    execute format('create policy cfg_read on public.%I for select to authenticated using (true);', t);
    execute format('drop policy if exists cfg_admin_write on public.%I;', t);
    execute format('create policy cfg_admin_write on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin());', t);
  end loop;
end $$;

-- NOTE: `settings` currently holds the admin password in plaintext. Once the
-- admin authenticates via Supabase Auth (below), delete that row:
--   delete from public.settings where key = 'admin_password';

-- 5) Remove anon access entirely (the public key can no longer read/write).
revoke all on all tables in schema public from anon;
-- authenticated keeps table privileges; RLS above scopes what it can see.
grant usage on schema public to authenticated;
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;

-- ============================================================
-- REQUIRED APP CODE CHANGES to ship with this migration:
--   1. Admin login → supabase.auth.signInWithPassword, then verify
--      is_admin() (RPC) before granting the admin console. The admin_email
--      account needs a password set (via the admin-users Edge Function).
--   2. Employee portal → read colleague roster from `employees_public`;
--      read own row from `employees`.
--   3. Every employee must have employees.auth_uid populated (set it when the
--      admin-users function creates/links their Supabase Auth user).
--   4. Remove settings.admin_password usage from the client.
-- ============================================================

-- ============================================================
-- STATUS (paused — resume when employees have real emails)
-- ------------------------------------------------------------
-- ALREADY APPLIED to the project (safe, additive; RLS still OFF):
--   • app_admins table + is_admin() function
--   • employees_public view (roster without password_plain)
--   • auth_uid backfilled where a Supabase Auth account already existed
--
-- BLOCKED ON DATA (do these before enabling RLS):
--   1. Give EVERY employee a unique, real email (admin → Settings).
--   2. Fix the collision: "Aishwarya Kadam" currently uses the ADMIN email
--      (shubhamkadam517@gmail.com) — change it; keep that email admin-only.
--   3. Provision a Supabase Auth login for the admin AND every employee
--      (admin → Reset Password per employee runs the admin-users function;
--       or bulk-provision using each employee's stored password_plain).
--
-- THEN run the RLS/policy statements above, and verify:
--   • admin logs in and sees all data,
--   • an employee logs in, submits a DSR, sees ONLY their own data,
--   • an employee canNOT read another employee's password.
-- Rollback if anything breaks: re-run supabase/fix-dsr-rls.sql (disables RLS).
-- ============================================================
