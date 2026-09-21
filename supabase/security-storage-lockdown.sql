-- ============================================================
-- SECURITY — Lock down the design-files storage bucket  (STEP 6 of the cutover)
-- ⚠ RUN ONLY AFTER the auth cutover (steps 1-3) is live and verified, AND the
--   frontend has been switched to signed URLs (see FRONTEND CHANGE below).
--   The bucket is currently PUBLIC and the app stores public file_url values;
--   making it private without the signed-URL change will break design file viewing.
--
-- WHAT IT DOES
--   1. Marks the 'design-files' bucket private (objects no longer readable by URL).
--   2. Replaces the anon storage policies with authenticated-only policies, so only
--      logged-in users (JWT) can read/upload/delete, and only in this bucket.
--
-- FRONTEND CHANGE REQUIRED BEFORE THIS (kept minimal, no redesign):
--   Anywhere the app renders/downloads a design file by its stored public URL,
--   fetch a short-lived signed URL on demand instead:
--     const { data } = await supabase.storage.from('design-files')
--       .createSignedUrl(file_path, 60 * 10);   // 10-minute link
--   Uploads continue to use supabase.storage.from('design-files').upload(...).
--
-- ROLLBACK:
--   update storage.buckets set public = true where id = 'design-files';
--   -- and recreate the anon policies from design_files.sql
-- ============================================================

update storage.buckets set public = false where id = 'design-files';

drop policy if exists design_files_insert on storage.objects;
drop policy if exists design_files_select on storage.objects;
drop policy if exists design_files_delete on storage.objects;

create policy design_files_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'design-files');
create policy design_files_select on storage.objects
  for select to authenticated using (bucket_id = 'design-files');
create policy design_files_delete on storage.objects
  for delete to authenticated using (bucket_id = 'design-files');

notify pgrst, 'reload schema';

-- VERIFY:
--   • Public URL of an existing object now returns 400/403 (not the file).
--   • A logged-in user can still open a file via createSignedUrl(...).
--   • Anonymous (no JWT) createSignedUrl / download fails.
