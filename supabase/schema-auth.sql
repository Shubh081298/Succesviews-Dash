-- ============================================================
-- SuccessViews — Auth migration
-- Run this in the Supabase SQL editor (Dashboard → SQL).
-- Safe to run more than once (IF NOT EXISTS guards).
-- ============================================================

-- 1) Employee table: admin-visible plaintext copy + link to auth user.
alter table public.employees
  add column if not exists password_plain text;

alter table public.employees
  add column if not exists auth_uid uuid;

-- 2) Admin password + admin email live in the settings key/value table.
--    (setAdminPwd / setAdminEmail in AppDataContext upsert these keys.)
insert into public.settings (key, value)
values ('admin_password', 'Admin@123')
on conflict (key) do nothing;

-- Set this to the inbox that should receive the admin Forgot-Password OTP.
insert into public.settings (key, value)
values ('admin_email', 'CHANGE_ME@example.com')
on conflict (key) do nothing;

-- ------------------------------------------------------------
-- NOTE ON "admin can view current password"
-- ------------------------------------------------------------
-- Supabase Auth stores only a one-way hash, so the plaintext an
-- admin sees comes from employees.password_plain. It is written
-- whenever the admin creates or resets a password, and whenever an
-- employee completes a reset via /reset-password. If an employee
-- changes their password by some other means, this column can go
-- stale until the next admin reset.
--
-- Because this column holds plaintext, protect it with Row Level
-- Security so ordinary (employee) sessions cannot read it. Expose it
-- only to the service role / your admin path.

-- Salary deductions (added for the Payslip deduction feature).
alter table public.salaries
  add column if not exists deductions jsonb default '[]'::jsonb;

-- Assigned mail IDs per employee (Assign IDs feature).
alter table public.employees
  add column if not exists assigned_ids jsonb default '[]'::jsonb;
