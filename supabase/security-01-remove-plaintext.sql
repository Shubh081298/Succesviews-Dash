-- ============================================================
-- SECURITY 01 — Remove plaintext password storage  (SAFE TO RUN NOW)
-- Login never uses this column (it uses password_hash / the emp_login
-- RPC), so dropping it does not affect sign-in. This closes the
-- "admin can view an employee's real password" leak.
-- ============================================================

-- 1) Wipe any existing plaintext first (in case you prefer to keep the column).
update public.employees set password_plain = null where password_plain is not null;

-- 2) Drop the column entirely (recommended).
alter table public.employees drop column if exists password_plain;
