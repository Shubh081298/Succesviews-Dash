-- ============================================================
-- SECURITY — Revoke direct anon table access  (STEP 5 of the cutover)
-- ⚠ RUN ONLY AFTER the auth cutover (steps 1-3) AND RLS (step 4) are live
--   and BOTH portals have been verified to log in and load data with a JWT.
--   Running this before the cutover will break the current anon-key login.
--
-- WHAT IT DOES
--   The app currently does `grant all on <table> to anon` on core tables, so the
--   public anon key can CRUD everything via the REST API regardless of RLS.
--   Once every session carries a Supabase JWT (role = authenticated) and RLS is
--   enforcing per-row access, the anon role no longer needs table privileges.
--   This revokes them so unauthenticated REST calls can touch nothing.
--
-- ROLLBACK (only if the cutover is being reverted):
--   grant all on public.<table> to anon;   -- per table below
-- ============================================================

-- Core data tables (keep `authenticated` — RLS decides the rows).
revoke all on public.employees              from anon;
revoke all on public.submissions            from anon;
revoke all on public.salaries               from anon;
revoke all on public.settings               from anon;
revoke all on public.messages               from anon;
revoke all on public.leaves                 from anon;
revoke all on public.announcements          from anon;
revoke all on public.websites               from anon;
revoke all on public.custom_fields          from anon;
revoke all on public.departments            from anon;
revoke all on public.attendance_overrides   from anon;
revoke all on public.bank_details           from anon;
revoke all on public.expenses               from anon;
revoke all on public.design_projects        from anon;
revoke all on public.design_files           from anon;
revoke all on public.design_activity        from anon;
revoke all on public.design_push_subscriptions from anon;

-- Pipeline tables.
revoke all on public.pipeline_clients   from anon;
do $$
declare t text;
begin
  for t in
    select unnest(array['pipeline_followups','pipeline_contracts','pipeline_sales',
                        'pipeline_payments','pipeline_notes','pipeline_history','pipeline_statuses'])
  loop
    if to_regclass('public.'||t) is not null then
      execute format('revoke all on public.%I from anon', t);
    end if;
  end loop;
end $$;

-- Keep the login RPCs callable only where still needed. After step 3 retires the
-- bcrypt fallbacks, also: revoke execute on function public.admin_login(text) from anon;
-- (leave until the frontend no longer calls the no-JWT paths).

notify pgrst, 'reload schema';

-- VERIFY (run as anon / from the REST API, expect permission denied):
--   select * from public.employees limit 1;   -- must FAIL for anon after this
