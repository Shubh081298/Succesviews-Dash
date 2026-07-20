-- ============================================================
-- Design Management Phase 2 — file uploads + versioning (Storage).
-- Applied live. NOTE: the 'design-files' bucket is PUBLIC (files are
-- reachable by anyone with the URL) to match the app's current setup.
-- The security cutover will move this to a private bucket + signed URLs.
-- ============================================================

-- Storage bucket
insert into storage.buckets (id, name, public)
values ('design-files', 'design-files', true)
on conflict (id) do nothing;

-- Storage access policies (upload / read / delete for the app)
drop policy if exists design_files_insert on storage.objects;
drop policy if exists design_files_select on storage.objects;
drop policy if exists design_files_delete on storage.objects;
create policy design_files_insert on storage.objects for insert to anon, authenticated with check (bucket_id = 'design-files');
create policy design_files_select on storage.objects for select to anon, authenticated using (bucket_id = 'design-files');
create policy design_files_delete on storage.objects for delete to anon, authenticated using (bucket_id = 'design-files');

-- File metadata + version history
create table if not exists public.design_files (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid references public.design_projects(id) on delete cascade,
  kind              text default 'reference',   -- reference | draft | sample | revised | final
  version           int  default 1,
  file_name         text,
  file_path         text,   -- storage object path
  file_url          text,   -- public URL
  file_type         text,
  size_bytes        bigint,
  uploaded_by       text,
  uploaded_by_name  text,
  created_at        timestamptz default now()
);
create index if not exists idx_design_files_project on public.design_files (project_id);
grant all on public.design_files to anon, authenticated;
notify pgrst, 'reload schema';
