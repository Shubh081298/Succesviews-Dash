# Security cutover runbook (staged, dependency-ordered)

Fixes the four coupled blockers: RLS off, public anon key exposure, public storage bucket,
privileged writes on the client. **Do these in order.** Run each on a **staging copy first**,
verify, then production. Do not skip ahead — enabling RLS (step 4) before the auth cutover
(steps 1–3) will lock out the current login.

Current reality (from code): admin logs in with bcrypt against `settings` (no JWT); employees
use Supabase Auth *and* a bcrypt fallback (`loginEmployee`, no JWT). RLS keyed on `auth.uid()`
denies no-JWT sessions, so every session must carry a JWT before RLS can go on.

---

## Step 1 — Provision Supabase Auth users (admin + all active employees)
- Deploy the Edge Function: `supabase functions deploy admin-users`.
- For the admin: create an auth user for the configured admin email with a chosen password.
- For each active employee: call `admin-users` `{action:'upsert', email, password}` (script the loop),
  or use the admin panel's existing create/reset flow which already invokes it.
- **VERIFY:** every active employee + admin appears in Supabase → Authentication → Users.
- **STATUS: BLOCKED — REQUIRES LIVE ACCESS** (service role + live project).

## Step 2 — Backfill `auth_id` + `role`
- Run the column + backfill section of `security-02-rolebased-rls.sql` (top half only):
  add `employees.auth_id`, `employees.role`; match `auth_id` by email; set `role='admin'` for admin.
- **VERIFY:** `select count(*) from employees where auth_id is null and status <> 'terminated';` returns 0.
- **STATUS: BLOCKED — REQUIRES LIVE ACCESS.**

## Step 3 — Frontend: authenticate only via Supabase Auth (minimum change)
- Admin login: replace the `loginAdmin` bcrypt-against-settings check with
  `supabase.auth.signInWithPassword(adminEmail, password)`. Keep the same screen/fields
  (email is the configured admin email; password field unchanged).
- Employee login: keep `employeeSignIn`; remove the `loginEmployee` bcrypt fallback so no
  session is created without a JWT.
- Keep bcrypt helpers only for the admin-managed employee-record copy if still needed elsewhere.
- **VERIFY (must be a real login against the project from step 1):** admin loads `/admin`;
  an employee loads `/`; a designer loads the designer view; no console/network 401s.
- **STATUS: BLOCKED — deploy + live verification required** (do not ship before steps 1–2 pass).

## Step 4 — Enable RLS + role policies
- Run the policy section of `security-02-rolebased-rls.sql` (after the backfill section).
- **VERIFY:** admin sees all rows; an employee sees only their own; cross-user read via REST fails.
- **STATUS: BLOCKED — REQUIRES LIVE ACCESS** (only after step 3 verified).

## Step 5 — Revoke direct anon table access
- Run `security-revoke-anon.sql`.
- **VERIFY:** an anonymous REST call (`select * from employees`) returns permission denied;
  both portals still work (they now use JWT).
- **STATUS: BLOCKED — REQUIRES LIVE ACCESS** (only after step 4 verified).

## Step 6 — Private storage bucket + signed URLs
- Frontend: fetch `createSignedUrl(file_path, 600)` on demand where files are viewed/downloaded
  (uploads unchanged). Then run `security-storage-lockdown.sql`.
- **VERIFY:** old public URL no longer serves the file; logged-in users open files via signed URL;
  anonymous access fails.
- **STATUS: BLOCKED — deploy + live verification required.**

---

## Rollback
Each SQL file lists its own rollback. The safe global rollback is: re-`grant all … to anon`,
`disable row level security`, set the bucket `public=true`, and revert the frontend deploy —
which returns to today's behaviour. Test rollback on staging too.

## What is NOT changed
No features added, no redesign, no workflow changes beyond the admin sign-in moving to Supabase
Auth (the one change RLS technically requires). Admin, Manager, Employee, Designer, Pipeline,
Salary, Expense, DSR, and Insertion Order functionality are untouched by these steps.
