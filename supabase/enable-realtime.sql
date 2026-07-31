-- ============================================================
-- Enable Supabase Realtime on the tables the app subscribes to.
-- Run ONCE in Supabase → SQL Editor. Safe to re-run (skips tables
-- that are already in the realtime publication).
--
-- After this, Admin ↔ Designer dashboards update instantly on every
-- workflow change (projects, files, activity/chat), plus DSR
-- submissions, leaves, messages, settings (designer payments/work),
-- and employees — no waiting for the 30s poll.
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'design_projects','design_files','design_activity',
    'submissions','leaves','messages','settings','employees'
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null;   -- already in the publication
      when others then null;             -- ignore (e.g. table missing)
    end;
  end loop;
end $$;

-- VERIFY (should list the tables above):
--   select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by tablename;
