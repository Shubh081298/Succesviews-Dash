# SuccessViews CRM — Product Inspection Report

Grounded in a code trace of the actual app (data layer, Pipeline, DSR, analytics,
permissions). Each item cites the file where the behaviour lives and a priority.
"Verified" = confirmed in code this pass. "Risk" = strong concern to test.

---

## 1. Critical Bugs

**C1 — Multi-currency payments/sales are summed together (money is wrong).** *(Verified)*
`AppDataContext.jsx › upsertSubmission()` does `payment_received: sumAmt(payRows)` and
`sales_generated: sumAmt(salesRows)` — it adds raw `amount` across **every currency**, then
stores a single `currency: payRows[0]?.currency` (just the first row's). So a client paying
$1,000 + ₹5,000 is recorded as `6000` "USD". Every downstream number that reads these scalars
(Payment Received KPI card, Reports table, Leaderboard, Analytics totals) is therefore
inaccurate the moment two currencies exist. Only the new **Sales & Payments Trend** chart is
currency-correct (it reads the raw `pipeline_payments`/`pipeline_sales` rows).
**Fix (Critical):** store per-currency totals (JSON like `{USD: 1000, INR: 5000}`) or stop
aggregating currencies into one scalar; make the Payment KPI + Reports currency-aware like the trend chart.

**C2 — No server-side permissions; any employee can read/write every client.** *(Verified)*
`pipeline-schema.sql` enables RLS but with `for all using (true) with check (true)` and the app
uses the anon key. Ownership is enforced only in the browser (`mine = clients.filter(employeeId === emp.id)`).
A user with dev tools (or the anon key) can read/edit/delete **all** clients, salaries, payments.
This is the single biggest launch blocker. (Already tracked as task #36.)
**Fix (Critical):** real auth-based RLS (`auth.uid()` / role claims), move admin-only tables behind policies.

**C3 — Workflow buttons can create duplicate contracts / sales / payments.** *(Verified)*
`LeadWorkflow.jsx › run()` has no idempotency guard. A double-click, slow network + retry, or
two people acting on the same lead will insert two `pipeline_contracts`/`sales`/`payments` rows and
advance the status twice. The auto contract number `CO-<first6 of id>` is identical on retries, so
you also get duplicate contract numbers.
**Fix (High→Critical):** disable the confirm button after first click (already partially via `busy`,
but the dialog can be reopened), and guard against creating a second contract/sale/payment when one
already exists for the stage.

---

## 2. Functional Bugs

**F1 — Soft-deleted clients leave orphaned money in analytics.** *(Verified)*
`softDeletePipelineClient()` sets `is_deleted=true` and drops the client from state, but the related
`pipeline_sales`/`payments`/`contracts` rows stay. The Trend chart and any per-currency totals that
read those tables still count a deleted client's payments. The client filter uses `!c.isDeleted`, but
the money tables aren't filtered by it.
**Fix (High):** filter sales/payments/contracts to live client IDs in analytics, or soft-delete children too.

**F2 — Duplicate leads slip through when Domain is blank.** *(Verified)*
The DB unique index is `unique(lower(client_email), domain_id) where is_deleted=false and client_email is not null`.
Domain is now free-typed and optional in places, so `domain_id` is often **null** → the index doesn't
apply and the same email can be added many times. The client-side check only scans `mine` (the current
employee), so two employees can create the same client.
**Fix (High):** dedupe on `(lower(email))` globally or make domain required; surface a "possible duplicate" warning.

**F3 — Timezone: "today" is computed in UTC.** *(Risk — verified pattern)*
`todayStr()` / date helpers use `new Date().toISOString().slice(0,10)` (UTC). For users in IST/GST,
after ~evening the app's "today" rolls to tomorrow, so a DSR or follow-up dated "today" can land on the
wrong calendar day, and "Overdue/Due today" flags can be off by one.
**Fix (Medium):** compute the local date (or the org's timezone) instead of UTC.

**F4 — Trend chart can under-report on the Month view.** *(Risk)*
The trend buckets pipeline payments by exact date-string match to `ovBarData` dates. If the Month view
buckets by week/month label rather than per-day, payment rows won't match and show 0. Today/Week are fine.
**Fix (Medium):** bucket pipeline rows by the same granularity the axis uses.

**F5 — Rollup can drift from source of truth.** *(Risk)*
Every Pipeline write also rolls up into "today's" submission row. If the same follow-up/sale is edited
or the rollup runs twice (realtime + manual), counts in the DSR/Reports can diverge from the actual
`pipeline_*` tables. The Pipeline tables are authoritative; the submission scalars are a denormalised copy.
**Fix (Medium):** treat pipeline tables as the single source for sales/payment analytics; use the rollup only for email/hours/attendance.

---

## 3. Business-Logic Issues

- **B1 (High):** Payments have no link to a contract/sale and no "expected amount", so **partial
  payments and overpayments can't be detected** — the system happily records any number. Consider an
  invoice/expected-total model.
- **B2 (Medium):** A lead can jump straight to "Sale Generated"/"Payment" without a contract if status is
  edited manually; the workflow buttons gate this, but the manual status field in Edit does not.
- **B3 (Medium):** "Cancelled sale" / "reopened project" / refunds have no representation — once
  Completed there's no reverse path, and analytics can't subtract a reversed deal.
- **B4 (Low):** Contract numbers are derived from the client id, not sequential/unique per contract —
  two contracts on one client collide.

---

## 4. UI/UX Problems

- **U1 (Medium):** Payment KPI card and Reports show a single currency-blind number (see C1) — misleading.
- **U2 (Low):** Long lists (thousands of leads) render every card/row with no virtualisation or
  pagination — see Performance.
- **U3 (Low):** Some success/error feedback is toast-only; destructive admin delete uses an inline
  confirm (good), but there's no undo for the soft delete.
- **U4 (Low):** Loading states are minimal on the Pipeline/analytics (data pops in); add skeletons.

---

## 5. Database Problems

- **D1 (Critical):** Permissive RLS (see C2).
- **D2 (High):** Duplicate index ineffective when `domain_id` is null (see F2).
- **D3 (Medium):** No FK-level cascade policy decision for soft delete → orphaned children (see F1).
- **D4 (Medium):** `submissions.currency` is a single column but the row aggregates multiple currencies (see C1).

## 6. Permission Issues
- Client-side-only role gating everywhere (see C2). Admin vs Employee is a UI route, not a DB boundary.

## 7. Performance / Scalability
- **P1 (High at scale):** All Pipeline/analytics load full tables into the browser (`select("*")`) and
  filter in JS. At thousands of clients this is slow and memory-heavy. Add server-side pagination,
  date-range queries, and indexes on `(employee_id, next_follow_up)`.
- **P2 (Medium):** `lastActivityOf()` scans all history/followups/sales/payments per row on every render.

## 8. Security Risks
- Anon key + permissive RLS (C2); plaintext admin/employee passwords referenced in the memory/notes
  (`DEFAULT_ADMIN_PWD`, `passwordPlain`) — should be hashed and never sent to the client.

## 9. Missing Features (for "enterprise-ready")
- Audit log of who changed what (history exists per-client but not a global immutable log).
- Invoices / expected amounts / partial-payment tracking (B1).
- Currency-grouped reports & KPI cards (C1).
- Bulk actions, CSV import, and dedupe tooling.

## 10. Workflow Improvements
- Idempotent workflow actions (C3); duplicate-lead warning (F2); reverse/cancel path (B3).

## 11. Scalability Concerns
- Full-table client-side loading (P1); rollup denormalisation drift (F5).

---

## 12. Recommended Fix Order

| # | Issue | Priority | Status |
|---|-------|----------|--------|
| C2/D1 | Real RLS + role enforcement; hash passwords | **Critical** | Passwords: **DONE** (plaintext removed & column dropped live). RLS: staged migration ready (`security-02-rolebased-rls.sql`) — needs the auth cutover first. |
| C1/D4 | Currency-correct payment/sale aggregation across KPI + Reports | **Critical** | **DONE** — Trend chart, KPI cards, and Reports table now group by currency from the real pipeline rows (no mixing). |
| C3 | Idempotent contract/sale/payment workflow actions | **High** | **DONE** — re-entrancy guard + stage re-check + duplicate-contract guard + unique contract number. |
| F1 | Filter analytics to live (non-deleted) clients | **High** | **DONE** — KPI money, trend chart, and Reports now exclude soft-deleted clients' sales/payments. |
| F2/D2 | Global duplicate prevention + warning | **High** | **DONE** — pre-insert check on (email, domain) across ALL employees, works even when domain_id is null. |
| B1 | Expected amount / partial-payment model | **High** | **DONE (code)** — sale sets the agreed deal value; payments accumulate; status becomes Payment Completed only when fully paid; progress bar + outstanding shown. Run `pipeline-expected-amount.sql` to persist server-side (app works without it). |
| P1 | Server-side pagination + date-range queries | **High (at scale)** | **PARTIAL** — added DB indexes for the app's query patterns (`perf-01-indexes.sql`, run live) + render caps (300 rows) on the admin all-clients table and employee pipeline list. Full server-side pagination still needs a data-layer redesign (deferred: many features rely on the in-memory dataset). |
| F3 | Local-timezone date logic | **Medium** | **DONE** — `localDateStr` used everywhere; "today"/overdue now use the local calendar date, not UTC. |
| F4/F5 | Trend bucketing + rollup-as-source-of-truth | **Medium** |
| B2/B4 | Status gating (block manual workflow statuses) + unique contract numbers | **Medium** | **DONE** — workflow-controlled statuses can't be typed manually; contract numbers carry a unique suffix. |
| B3 | Reverse / cancel / refund path | **Medium** | **DONE** — admin can reverse any payment (records a negative offsetting entry so analytics net out, full audit trail) and cancel a deal (status → Cancelled, excluded from active pipeline). |
| U1 / U3 | Currency in KPI/Reports; soft-delete undo | **Medium** | **DONE** — U1 via C1; U3 = "Recently deleted" list with Restore in the Client Pipeline panel. |
| U2 / U4 | List virtualisation / pagination; skeleton loaders | **Low** | Open — tie U2 to P1 (server-side pagination). |

**Bottom line:** the app is feature-complete and the UX is polished, but three things block a real
launch — server-enforced permissions (C2), currency-correct money math (C1), and idempotent workflow
writes (C3). Fix those first; the rest are hardening.
