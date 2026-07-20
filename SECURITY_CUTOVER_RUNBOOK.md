# SuccessViews — Security Cutover Runbook (RLS + password hashing)

**Goal:** make the app safe for public exposure — no plaintext passwords anywhere, and Row-Level Security (RLS) ON so the public/anon key **cannot** read or write your data. Every request must carry a real per-user login (Supabase Auth), and each person sees only what they're allowed to.

**Why this is a project, not a switch:** your app currently works because *everyone* (admin + employees) talks to the database with the **public key** and RLS is **off**. Turning RLS on instantly blocks that access, so the whole app must first move to real per-user logins. Doing this blind on the **live, in-use** database would lock out you and your team. So we do it **on a staging copy first, test every role, then cut over in a short maintenance window.**

---

## Phase 0 — Data prerequisites (do these first; blocks everything)

RLS needs a real login account per person. Today several employees can't get one:

1. **Give every employee a unique, real email.** Blank emails (Shubham Kadam, Vinod, Om, Test in the current data) must be filled in via Admin → Settings.
2. **Fix the email collision** — "Aishwarya Kadam" currently uses the **admin** email `shubhamkadam517@gmail.com`. Give her a different email; keep that address admin-only.
3. **Pick the admin's login email** (the one that will own the admin account).

Until every person has a unique email, the cutover cannot complete.

---

## Phase 1 — Create a staging Supabase project (safe sandbox)

1. supabase.com → **New project** (call it `successviews-staging`, same region).
2. In the SQL editor of staging, recreate the schema. Fastest path: in the **production** project → Database → **Backups / Schema** (or run `pg_dump`), then load it into staging. If unsure, I can generate a full `schema.sql` from your live tables for you to run.
3. Copy a **sample of data** into staging (a few employees with real emails + a few submissions/salaries/expenses) — enough to test all roles. Don't copy real data you don't need.
4. Locally, point the app at staging by editing `.env`:
   ```env
   VITE_SUPABASE_URL=https://<staging-project>.supabase.co
   VITE_SUPABASE_ANON_KEY=<staging anon key>
   ```
   Run `npm run dev` — you're now developing against staging, production untouched.

---

## Phase 2 — Code changes (I implement these against staging)

These are the app changes required for RLS to work. I'll write and test them on staging:

1. **Admin → real Supabase Auth account.** Admin login switches to `supabase.auth.signInWithPassword(adminEmail, password)`, then verifies `is_admin()` (an RPC) before granting the console. Remove the client-side/`admin_login` shortcut.
2. **Employees → real Supabase Auth accounts.** Employee login switches to `supabase.auth.signInWithPassword(email, password)`. Remove the `emp_login` RPC + the `password_plain` fallback. Every employee row gets its `auth_uid` populated.
3. **Provisioning on "Add Employee".** Creating an employee also creates their Supabase Auth user (via the `admin-users` Edge Function, which already exists) and stores their `auth_uid`. Show a clear error if the account can't be created (no more silent failures).
4. **Data layer under RLS** (`AppDataContext`):
   - Employees read the roster from the `employees_public` **view** (no passwords) and their **own** rows only.
   - Admin reads everything (allowed by `is_admin()` policies).
5. **Remove all `password_plain` usage** — from `loadEmployees`, `addEmployee`, `resetEmployeePassword`, and `ResetPasswordPage` (the line that writes the plaintext back). Passwords live only as Supabase Auth credentials (already bcrypt-hashed by Supabase).

---

## Phase 3 — Database changes (run on staging, in order)

Use the prepared `supabase/security-hardening.sql` (already written). It:

1. Creates `app_admins` + `is_admin()` (security-definer).
2. Creates the `employees_public` view (roster **without** password columns).
3. **Enables RLS** on every table and adds policies:
   - admin (`is_admin()`) → full access;
   - employee → only rows where `emp_id` maps to their `auth.uid()`;
   - anonymous → **nothing**.
4. **Revokes** all anon access.
5. Then, once login works: **drop the `password_plain` column** and **delete the `settings.admin_password` row** (no longer needed).

---

## Phase 4 — Test on staging (must all pass before touching production)

- [ ] **Admin** logs in (real email + password) → sees all data, all modules work (Salary, Expense, Insertion Order, Leave, Reports, Analytics).
- [ ] **Employee** logs in → can submit a DSR, request leave, see their own history/salary/assigned IDs.
- [ ] **Employee CANNOT** see another employee's data, salaries, or any password (verify via the browser Network tab — try `/rest/v1/employees?select=*` and confirm it returns nothing / only allowed columns).
- [ ] **Anonymous** (not logged in) hitting `/rest/v1/salaries?select=*` returns **no rows**.
- [ ] Password reset flow works end-to-end.
- [ ] Add-employee creates a working login.

---

## Phase 5 — Production cutover (short maintenance window)

1. **Tell the team** to pause use for ~30 min.
2. Ensure **every employee has a unique email** in production (Phase 0).
3. **Provision Supabase Auth accounts** for the admin + every employee in production, and backfill `auth_uid`.
4. **Deploy** the new code (push → Vercel).
5. **Run `security-hardening.sql`** on the production project.
6. **Smoke test** live: admin login, one employee login + DSR submit, confirm anon gets nothing.
7. Add your production domain to Supabase → **Authentication → URL Configuration** (for reset emails).

**Rollback (if anything breaks):**
- Re-run `supabase/fix-dsr-rls.sql` (disables RLS) — restores the previous open-but-working state instantly.
- Redeploy the previous code from GitHub (Vercel → Deployments → previous → Promote).

---

## Effort & recommendation

- Phase 0 (emails): **you**, ~30 min.
- Phases 1–4 (staging build + test): **me**, the bulk of the work, done safely off production.
- Phase 5 (cutover): ~30–60 min together, with rollback ready.

**Recommended order:** finish Phase 0 (emails) and create the staging project (Phase 1). Tell me when staging exists + its keys, and I'll implement and test Phases 2–4 there. We schedule Phase 5 when you're ready.

Until this is done, treat the live URL as **internal** — don't share it publicly.
