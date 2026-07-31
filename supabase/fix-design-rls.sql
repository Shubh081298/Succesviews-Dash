-- ============================================================
-- FIX: "new row violates row-level security policy for table design_projects"
-- ------------------------------------------------------------
-- Root cause: the three design tables were created with `grant all` but no
-- RLS configuration. RLS has since been switched ON for them (Supabase's
-- dashboard offers a one-click "Enable RLS"). A table with RLS enabled and
-- NO policies denies every read/write — so creating a project fails, and
-- file uploads + the activity timeline would fail next for the same reason.
--
-- ⚠️  SCOPE / HONESTY: this does NOT tighten security. It restores the same
-- permissive access the rest of this app already relies on (the anon key is
-- used as a trusted client — see fix-dsr-rls.sql). Anyone holding the public
-- anon key can read/write these three tables. That is the app's current
-- model everywhere, not something new introduced here.
--
-- The real per-user lockdown is the separate cutover documented in
-- security-hardening.sql / SECURITY_CUTOVER_RUNBOOK.md, which is still
-- blocked on every employee having a unique real email + Auth account.
--
-- Run once in Supabase → SQL Editor. Safe to re-run.
-- ============================================================

-- Keep RLS ON (so Supabase's linter stays quiet) and add permissive policies
-- that mirror how anon already accesses every other table in this app.
do $$
declare t text;
begin
  foreach t in array array['design_projects','design_files','design_activity']
  loop
    execute format('alter table if exists public.%I enable row level security;', t);
    execute format('drop policy if exists app_all_anon on public.%I;', t);
    execute format('create policy app_all_anon on public.%I for all to anon using (true) with check (true);', t);
    execute format('drop policy if exists app_all_authenticated on public.%I;', t);
    execute format('create policy app_all_authenticated on public.%I for all to authenticated using (true) with check (true);', t);
  end loop;
end $$;

-- Make sure the table privileges are present too (policies alone aren't enough).
grant usage on schema public to anon, authenticated;
grant all on public.design_projects to anon, authenticated;
grant all on public.design_files    to anon, authenticated;
grant all on public.design_activity to anon, authenticated;

notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- VERIFY (should return 3 rows, each rowsecurity = true with 2 policies):
--   select tablename, rowsecurity from pg_tables
--   where schemaname='public'
--     and tablename in ('design_projects','design_files','design_activity');
--
--   select tablename, policyname, roles from pg_policies
--   where schemaname='public'
--     and tablename in ('design_projects','design_files','design_activity');
--
-- ROLLBACK (if needed):
--   alter table public.design_projects disable row level security;
--   alter table public.design_files    disable row level security;
--   alter table public.design_activity disable row level security;
-- ------------------------------------------------------------
