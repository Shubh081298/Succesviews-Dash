-- Pipeline: Contract Signed phase + admin manual employee name.
-- Run this once in the Supabase SQL editor before using the 3-phase pipeline.
alter table public.pipeline_clients
  add column if not exists manual_employee_name    text,
  add column if not exists contract_signed_file_url  text,
  add column if not exists contract_signed_file_name text,
  add column if not exists signed_amount           numeric(14,2),
  add column if not exists signed_date             date,
  add column if not exists project_name            text,
  add column if not exists notes                   text;

grant all on public.pipeline_clients to anon, authenticated;

-- OPTIONAL — start the pipeline fresh (permanently deletes all current clients).
-- Uncomment and run only if you want to wipe existing clients:
-- delete from public.pipeline_clients;
