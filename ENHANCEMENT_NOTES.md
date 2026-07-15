# SuccessViews Dashboard — Enhancement Update (2026-06-29)

## ⚠️ RUN THIS FIRST
Open Supabase → SQL Editor → paste & run **`migration.sql`** (in this folder).
It adds the columns the new DSR needs. Until it runs, saving a DSR will fail
(reads degrade gracefully to empty rows, so the app still loads).

## What changed

### Branding
- Logo background removed → transparent PNG, used everywhere (login + sidebar).
- Premium sidebar (gradient, active-item accent bar), consistent logo sizing.

### Employee Portal
- New **premium welcome card**: Welcome Back, Department, Email, Team Lead, message.
- **Attendance**: Present / Half Day / Absent. Absent hides all DSR fields (just Submit).
- **Sales/Operations DSR** reworked into repeatable rows with **NA / + Add**:
  - New Leads (Client, Price, ID Name, Domain: AWL/CIO/Others)
  - Client Follow-ups (Client, Domain)
  - Scheduled Calls (Client, ID Name, Domain, Time + timezone)
  - Sales Generated (Amount, Currency [USD default], ID Name)
  - Payment Received (Amount, Currency, ID Name)
  - Fresh Emails / Reminder Emails / Working Hours = numeric
  - Operations also keeps **Website Work**.
- Removed **Challenges Faced**, **Additional Remarks**, **Save Draft** (Submit only).
- "Updates for **{Team Lead name}**" auto-labelled.
- Menu: My History (read-only), Leave (apply + history + 30-day backdate + "Waiting for
  Manager Approval"), **Assigned IDs** (view only), Settings (name/ID/team lead/photo).

### Admin Portal
- **Overview**: 5 primary cards (Fresh Emails, Reminder Emails, New Leads, Follow-ups,
  DSR Submitted) + 5 secondary (Scheduled Calls, Team Lead Updates, Sales, Contract
  Orders, Payment Received). Filters: Today / This Week / This Month / Custom. Every
  card drills into the underlying rows.
- **Reports**: added Department filter + Payments column; **View** button now works.
- **Leaderboard**: Sales & Payments ranking with Week / Month / Year.
- **Leave Board**: pending vs history, **remark required** before approve/reject,
  sidebar shows a pending-count badge.
- **Settings**: employee **Email** field; **two-step** admin password change
  (current + new + confirm).
- DSR field add/remove now asks for confirmation.

## Data model note
The repeatable rows are stored as JSONB (`leads_data`, `followups_data`, `calls_data`,
`sales_data`, `payments_data`). The existing scalar columns now hold derived totals/counts
so all aggregations keep working. Employees only submit; only admins edit field config.

## Build
`npx vite build` → 904 modules, no errors. (On the build sandbox, `dist/` deletion can
hit a Windows-mount EPERM; build to a fresh folder if needed: `npx vite build --outDir distX`.)
