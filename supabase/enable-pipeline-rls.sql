-- ============================================================
-- Enable Row-Level Security on the Pipeline tables (+ masters).
-- Standalone, idempotent, safe to run anytime. Enables RLS AND adds a
-- permissive access policy in one step, so the app keeps working
-- (matches the existing tables' access model / anon key + in-app gating).
-- Run this in the Supabase SQL editor to clear the "Table publicly
-- accessible / rls_disabled_in_public" security advisor warning.
-- ============================================================

do $$
declare
  t text;
  tables text[] := array[
    'domains',
    'pipeline_status_master',
    'pipeline_clients',
    'pipeline_followups',
    'pipeline_contracts',
    'pipeline_sales',
    'pipeline_payments',
    'pipeline_notes',
    'pipeline_history'
  ];
begin
  foreach t in array tables loop
    -- Only touch tables that actually exist (skip any not yet created).
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      -- Recreate a single permissive "all" policy (drop-then-create = idempotent).
      execute format('drop policy if exists %I on public.%I', t || '_all', t);
      execute format(
        'create policy %I on public.%I for all to public using (true) with check (true)',
        t || '_all', t
      );
      raise notice 'RLS enabled + policy set on public.%', t;
    else
      raise notice 'skipped (table does not exist yet): public.%', t;
    end if;
  end loop;
end $$;

-- Verify: every pipeline/master table should now show rowsecurity = true.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'domains','pipeline_status_master','pipeline_clients','pipeline_followups',
    'pipeline_contracts','pipeline_sales','pipeline_payments','pipeline_notes','pipeline_history'
  )
order by tablename;
