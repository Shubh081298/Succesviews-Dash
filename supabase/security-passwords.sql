-- ============================================================
-- SECURITY: stop exposing employee + admin passwords to the public key.
-- Login checks move INTO the database (SECURITY DEFINER functions), so
-- plaintext passwords are never downloaded to the browser.
-- ============================================================

-- ---------- PART 1 — run NOW (additive & safe) ----------

-- Employee login (server-side password check; returns only the id).
create or replace function public.emp_login(p_email text, p_password text)
returns table(id text)
language sql security definer set search_path = public as $$
  select id::text from public.employees
  where lower(email) = lower(p_email) and password_plain = p_password
  limit 1;
$$;
revoke all on function public.emp_login(text, text) from public;
grant execute on function public.emp_login(text, text) to anon, authenticated;

-- Admin login (server-side; falls back to the default if no password is set,
-- so you can never get locked out).
create or replace function public.admin_login(p_password text)
returns boolean
language sql security definer set search_path = public as $$
  select case
    when exists (select 1 from public.settings where key = 'admin_password')
      then exists (select 1 from public.settings where key = 'admin_password' and value = p_password)
    else p_password = 'Admin@123'
  end;
$$;
revoke all on function public.admin_login(text) from public;
grant execute on function public.admin_login(text) to anon, authenticated;


-- ---------- PART 2 — run ONLY AFTER the new frontend is deployed AND you've
--            confirmed both admin + employee login still work on the live site.
--            This is what actually hides the passwords from the public key. ----------

-- Hide the plaintext password from the public/anon key (keeps password_hash,
-- which the employee "change my password" flow still needs). SAFE to run now:
-- the deployed app no longer selects password_plain.
--   revoke select on public.employees from anon, authenticated;
--   grant  select (id, name, department, code, photo, team_lead, email, password_hash, assigned_ids, created_at)
--          on public.employees to anon, authenticated;
-- Verify after: employees list still loads; admin + employee login still work;
-- reload the live site and confirm the employees request no longer returns password_plain.

-- Hide the admin password row from the public/anon key:
--   alter table public.settings enable row level security;
--   drop policy if exists settings_read on public.settings;
--   create policy settings_read on public.settings for select to anon, authenticated
--     using (key <> 'admin_password');
--   drop policy if exists settings_write on public.settings;
--   create policy settings_write on public.settings for all to anon, authenticated
--     using (true) with check (true);


-- ---------- ROLLBACK for Part 2 (run if any login breaks) ----------
--   grant select on public.employees to anon, authenticated;
--   alter table public.settings disable row level security;
