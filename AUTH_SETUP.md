# Authentication Setup

The employee login, forgot-password, and admin magic-link recovery flows are wired in the app,
but they rely on Supabase configuration that must be done in your Supabase
dashboard. Do these steps once.

> Live status (done for you via the Supabase dashboard):
> - ✅ SQL migration run (columns + admin settings; `admin_email` = shubhamkadam517@gmail.com)
> - ✅ Redirect URLs added: http://localhost:5173/** and http://localhost:3000/**
> - ✅ Edge Function `admin-users` deployed
> - ✅ Admin Forgot-Password switched to a **magic link** — works on Supabase's
>   default email template, no SMTP or `{{ .Token }}` edit required.
> Remaining (optional, needs YOUR credentials):
> - ⛳ Custom SMTP (Auth → Emails → SMTP Settings). The built-in email sender is
>   rate-limited to a few messages/hour and mainly for testing — add SMTP for
>   real volume. Not required for the flows to work.
> - ⛳ Employee auth users: now that the Edge Function is live, opening an
>   employee's **Reset Password** in the admin panel (with the app running)
>   provisions their Supabase Auth user automatically.

## 1. Run the SQL migration

Open **Supabase → SQL Editor** and run [`supabase/schema-auth.sql`](supabase/schema-auth.sql).
It adds `password_plain` and `auth_uid` to `employees` and seeds the
`admin_password` and `admin_email` settings. **Change `admin_email`** to the
inbox that receives the admin Forgot-Password sign-in link.

## 2. Configure email (Auth → Providers → Email)

- Enable **Email** provider.
- Leave **Email** enabled (magic links are sent through it for admin recovery).
- Set an SMTP sender (Auth → **SMTP settings**) so reset/OTP emails actually
  send. The built-in Supabase email is rate-limited and for testing only.
- **Auth → URL Configuration → Redirect URLs**: add your app origin plus
  `/reset-password`, e.g. `https://your-app.com/reset-password`
  (and `http://localhost:5173/reset-password` for local dev). The reset email
  link must be allowed to land there.

## 3. Deploy the admin Edge Function

Employees log in against Supabase Auth, so each employee needs an auth user.
Admin create/reset provisions that user through the service-role Edge Function
in [`supabase/functions/admin-users`](supabase/functions/admin-users/index.ts):

```bash
supabase functions deploy admin-users
```

No secret needed: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected
into the function automatically. The service-role key stays server-side — it is
never shipped to the browser.

If the function is not deployed, admin create/reset still writes the DB copy
(so "view password" works), but the Supabase Auth login password won't update
until it is deployed.

## 4. Migrate existing employees (one time)

Existing employees have no auth user yet. Either:

- Re-save each employee's password from the admin panel (**Reset Password**),
  which calls the Edge Function and creates their auth user, **or**
- Have each employee use **Forgot password?** on the login screen to set their
  own password (this also creates/links the auth user on first reset).

Make sure every employee row has the correct **email** — login matches the
Supabase Auth email to `employees.email`.

## What works after setup

- **Employee login** — email + password (Supabase Auth) with **Remember me**
  (session persists in localStorage when ticked, sessionStorage when not).
- **Employee Forgot password** — emails a reset link → `/reset-password` →
  new password (and syncs `password_plain` for the admin view).
- **Admin Forgot password** — emails a one-click sign-in link to `admin_email`;
  opening it returns to /admin/login where the admin sets a new admin password
  (persisted to `settings.admin_password`).
- **Admin password management** — per employee: **Reset Password** and
  **View password** (shows `employees.password_plain`).

## Security note

`password_plain` stores passwords in clear text so the admin can view them. Add
Row Level Security on `employees` so only the service role / admin path can read
that column — otherwise any authenticated employee could read everyone's
password. This is the trade-off of the "admin can view current password"
requirement.
