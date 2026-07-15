-- ============================================================
-- SuccessViews Dashboard — Schema migration
-- Run ONCE in the Supabase SQL editor (Project → SQL → New query).
-- Safe to re-run: every statement uses IF NOT EXISTS.
--
-- Adds the columns required by the DSR enhancement update:
--   • submissions: structured repeatable rows (Leads, Follow-ups,
--     Scheduled Calls, Sales, Payments) stored as JSONB arrays.
--   • employees:   email column (shown on the employee header card).
--   • leaves:      remark column (admin must add a remark before
--                  approving / rejecting a leave request).
-- ============================================================

-- ── submissions: structured DSR rows ────────────────────────
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS leads_data      jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS followups_data  jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS calls_data      jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS sales_data      jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS payments_data   jsonb NOT NULL DEFAULT '[]'::jsonb;

-- ── employees: contact email ────────────────────────────────
ALTER TABLE employees   ADD COLUMN IF NOT EXISTS email           text;

-- ── leaves: admin decision remark ───────────────────────────
ALTER TABLE leaves      ADD COLUMN IF NOT EXISTS remark          text;

-- ============================================================
-- Notes
-- • The existing scalar columns (new_leads_interested, new_follow_ups,
--   calls_scheduled, sales_generated, payment_received) are still
--   written by the app — they now hold the DERIVED totals/counts from
--   the JSONB arrays above, so all existing Overview / Analytics /
--   Leaderboard aggregations keep working unchanged.
-- • challenges_faced and remarks columns are left in place but are no
--   longer written by the new DSR form (the fields were removed from
--   the spec). No data loss for historical rows.
-- ============================================================

-- ── 2026-07-02: Contract Order Sent (new repeatable DSR section) ──
-- Run this once in Supabase → SQL Editor before using the Contract
-- Order Sent field. Until it exists, DSR submissions will fail to save.
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS contract_orders_data jsonb NOT NULL DEFAULT '[]'::jsonb;
