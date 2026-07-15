-- ============================================================
-- FIX: Employee DSRs not reflecting to admin after Supabase Auth login
-- ------------------------------------------------------------
-- Root cause: employees now log in via Supabase Auth, so their DB writes
-- carry an "authenticated" token instead of "anon". Row-Level Security on
-- these tables permitted the anon role (how the app always worked) but not
-- authenticated, so employee INSERT/UPDATE (DSR submit, etc.) were silently
-- rejected — the older anon-written rows still show, new ones never land.
--
-- This app uses the anon key as a trusted client (no per-user isolation;
-- it already reads/writes everything), so the correct fix is to stop RLS
-- from blocking the authenticated role. We disable RLS on the app's public
-- tables (safe here: anon already has full access, so this does not widen
-- exposure — it just lets logged-in employees write again).
--
-- Run this once in Supabase → SQL Editor. Safe to re-run.
-- ============================================================

alter table if exists public.submissions   disable row level security;
alter table if exists public.employees      disable row level security;
alter table if exists public.salaries       disable row level security;
alter table if exists public.settings       disable row level security;
alter table if exists public.messages       disable row level security;
alter table if exists public.leaves         disable row level security;
alter table if exists public.announcements  disable row level security;
alter table if exists public.websites       disable row level security;
alter table if exists public.custom_fields  disable row level security;
alter table if exists public.departments    disable row level security;

-- Ensure both roles retain table privileges (default in Supabase; harmless to re-grant).
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;

-- ------------------------------------------------------------
-- ALTERNATIVE (if you prefer to KEEP RLS enabled): instead of the DISABLE
-- statements above, add permissive policies for the authenticated role that
-- mirror anon, e.g. for each table:
--   create policy "app_all_authenticated" on public.submissions
--     for all to authenticated using (true) with check (true);
-- ------------------------------------------------------------
