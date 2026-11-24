# Phase 3 — Financial Intelligence and Prediction Engine

**Status:** Implemented and verified on 23 November 2026. **Not formally
closed:** revision `0003_phase3_intelligence` **is** applied to the development
database (verified read-only on 24 November 2026, `alembic check` clean), but
the three PostgreSQL-only locking tests have not been run against
`guardian_test`.

**Branch:** `feature/phase-1-foundation` (Phase 3 changes are uncommitted work
on top of Phase 1 commit `d55ca0e` and the uncommitted Phase 2 changes).

Phase 3 adds the deterministic financial-intelligence engine: budget planning,
cash-flow forecasting, risk detection, spending analysis, savings goals,
spending preferences, proactive spending awareness and monthly financial
reports. No AI/LLM integration is included (Phase 4). No notification is
delivered and no payment is executed.

## Requirement checklist

### Financial analysis

| Requirement | Status | Notes |
|---|---|---|
| Total income calculation | Complete | Signed transactions; monthly summary, one currency at a time |
| Total expense calculation | Complete | Positive magnitudes in summaries |
| Monthly financial summaries | Complete | `GET /intelligence/summary` with `year`/`month` |
| Category-wise expense analysis | Complete | `category_income` / `category_expenses` in the reported currency |
| Spending trends | Complete | `GET /intelligence/trends`, ISO-week totals and direction |
| Recurring payment analysis | Complete | Phase 2 `RecurringPaymentService` reused |
| Financial history analysis | Complete | 90-day history feeds income estimation and baselines |

### Cash flow prediction

| Requirement | Status | Notes |
|---|---|---|
| Upcoming expense calculation | Complete | Unpaid bills and active subscriptions in the window |
| Expected income calculation | Complete | Recurring-income estimate from 90 days of credits |
| Projected balance calculation | Complete | Opening available balance + expected income − obligations |
| Daily cash-flow projections | Complete | One entry per day; final entry equals `projected_balance` |
| Weekly and monthly forecasts | Complete | `days` parameter, 1–365 (default 30) |
| Low-balance prediction | Complete | Critical below zero; warning below 20% of obligations |
| Obligations due today / overdue | Complete | Both reduce the opening balance (`starting_obligations`) |
| Assumptions disclosed | Complete | `assumptions`, `income_basis`, `excluded_currencies` fields |

Income estimation rule: a source is recurring when it appears at least twice in
90 days with a median cadence of 5–45 days and every amount within 40% of the
source median; the monthly figure is `median × 30 / cadence`. Without a
recurring source the estimate is the 90-day monthly average and `income_basis`
says it is a fallback. With no income history it is `0.00`. This is a
heuristic, not a payroll schedule.

### Risk detection

| Requirement | Status | Notes |
|---|---|---|
| Unusual spending | Complete | Weekly spending above 150% of the 90-day weekly average |
| Duplicate transactions | Complete | Blocked manual duplicates persist a `duplicate_transaction` insight |
| Upcoming payment conflicts | Complete | Overdue bills critical; due-soon warning |
| Insufficient balance | Complete | From the forecast |
| Unusual spending-pattern changes | Complete | Trend direction increasing/decreasing/stable |
| Unreviewed recurring payments | Complete | Recurring suggestions without a matched bill/subscription |

### Budget planner and savings goals

| Requirement | Status | Notes |
|---|---|---|
| Monthly and category budgets | Complete | Optional `category_id`; explicit `period_start`/`period_end` |
| Create, edit, delete | Complete | `/budgets` CRUD, web and mobile screens |
| Spending vs budget | Complete | `spent`, `remaining`, `overspending`, `percent_used` |
| Overlap prevention | Complete | `409 budget_period_overlap` for overlapping active periods |
| Savings goals | Complete | CRUD, target/current, `remaining`, `percent_funded` |
| Savings summary | Complete | Per-currency totals plus `currency_breakdown` |

### Proactive spending awareness

| Requirement | Status | Notes |
|---|---|---|
| Configurable advance reminders | Complete | `reminder_advance_days`, default 3, stored per user |
| Due-date reminders | Complete | `enable_due_reminders` used by risk detection |
| Post-payment reminders | **Partial** | Preference stored; no post-payment scheduler exists |
| Entertainment alerts | Complete | `enable_entertainment_alerts` + category list, evaluated on transaction |
| Configurable threshold | Complete | `significant_spending_threshold`, default 5000.00 |
| Persist preferences | Complete | One `spending_preferences` row per user |
| Enabled by default | Complete | `proactive_awareness_enabled` defaults to `true` |
| Pre-transaction check | Complete | `POST /intelligence/proactive-awareness` |
| Post-transaction check | Complete | `POST /transactions` returns persisted `alerts` |
| Duplicate surfaced as risk | Complete | Insight recorded before `409 duplicate_transaction` |
| No interception claims | Complete | Advisory data only; nothing is blocked except the existing dedupe rule |
| Notification delivery | **Not implemented** | No email/push/SMS provider; insights are in-app records only |

### Financial reports

| Requirement | Status | Notes |
|---|---|---|
| Financial reports screen | Complete | Web `/reports`; mobile `reports.tsx` linked from UniFlow |
| Real stored data | Complete | Computed on demand from summary, transactions, budgets, savings |
| Income, expenses, net, savings rate | Complete | `savings_rate` is `null` when income is zero |
| Category and payee breakdown | Complete | Shares of expenses; top ten payees |
| Month-over-month change | Complete | Percent change; `null` when the previous value is zero |
| Explicit report notes | Complete | States single-currency and non-tax-document limitations |

### Currency correctness

| Requirement | Status | Notes |
|---|---|---|
| No silent currency mixing | Complete | Summary, trends, forecast, reports and savings are single-currency |
| Explicit breakdowns | Complete | `currency_breakdown` / `excluded_currencies` |
| No invented exchange rates | Complete | No FX conversion anywhere |
| Dashboard and savings UI | Complete | Both screens explain the reporting currency |

### Database entities

| Entity | Migration table | Status |
|---|---|---|
| Budgets | `budgets` | Migrated in `0003`, applied; table empty |
| Savings goals | `savings_goals` | Migrated in `0003`, applied; table empty |
| Spending preferences | `spending_preferences` | Migrated in `0003`, applied; table empty |
| Forecasts | `forecasts` | Migrated in `0003`, applied; table empty and API does not persist snapshots |
| Financial insights | `financial_insights` | Migrated in `0003`, applied; table empty |

Migration `0003_phase3_intelligence` revises `0002_phase2_financial` and is the
Alembic head. The ORM models were aligned to this revision (budget and
spending-preference check constraints, `spending_preferences.user_id` unique
without a separate index, no index on `budgets.category_id`) rather than adding
a fourth migration.

The development database is at `0003_phase3_intelligence`; it was applied by
the Docker backend's startup command (`alembic upgrade head && uvicorn ...`), not
by the Phase 3 implementation pass, and all five new tables hold zero rows. The
last model/migration drift (`Forecast` inherited `TimestampMixin` while revision
`0003` creates only `generated_at`) was resolved on 24 November 2026 by aligning
the model with the migration; `alembic check` now reports `No new upgrade
operations detected`.

## Verification evidence — 23 November 2026

### Backend

```text
cd backend
.\.venv\Scripts\python -m pytest -q
149 passed, 3 skipped, 1 warning in 64.91s
```

The three skips are PostgreSQL-only locking tests
(`test_auth.py:337`, `test_disabled_account_sessions.py:345` and `:529`) that
require `SELECT … FOR UPDATE`; SQLite cannot execute them. They were not run
against PostgreSQL in either pass: the first had the database at revision
`0002`, and the 24 November review found `guardian_test` empty, so running them
would create and drop every table in that test database and needs explicit
approval.

`backend/tests/test_phase3_final.py` adds 12 regression tests: forecast
due-today and opening-balance handling, exact final-day balance, recurring
income detection, currency-scoped summary/forecast/savings, reports,
authentication, significant/entertainment/duplicate alerts and user isolation.

### Web

```text
cd frontend/web
npx tsc -b          → passes
npx vitest run      → 55 passed across 12 files
npx vite build      → succeeds
npm run lint        → 0 errors, 1 warning (Fast Refresh in AuthContext)
```

New screens: `/budgets`, `/savings-goals`, `/spending-preferences`,
`/intelligence` and `/reports`. The transactions form runs the pre-check and
shows returned alerts. Tests include `ReportsPage.test.tsx` (3) and
`TransactionsPage.test.tsx` (3).

### Mobile

```text
cd mobile
npx tsc --noEmit    → passes
```

New routes: `budgets.tsx`, `savings-goals.tsx`, `spending-preferences.tsx`,
`intelligence.tsx` and `reports.tsx` (hidden tab, linked from UniFlow). The
transaction form runs the pre-check and displays alerts.

### Migration consistency

24 November 2026 (read-only review, after the `Forecast` alignment):

```text
cd backend
.\.venv\Scripts\alembic heads
0003_phase3_intelligence (head)

.\.venv\Scripts\alembic current
0003_phase3_intelligence (head)

.\.venv\Scripts\alembic check
→ No new upgrade operations detected.
```

The 23 November pass instead recorded `alembic current` =
`0002_phase2_financial`, with `alembic check` refusing because the database was
behind; the offline `upgrade 0002_phase2_financial:0003_phase3_intelligence --sql`
produced PostgreSQL DDL without writes. In between, the database reached `0003`
through the Docker backend's startup `alembic upgrade head`. Model constraints
were inspected and match the revision for `budgets`, `savings_goals`,
`spending_preferences`, `forecasts` and `financial_insights`.

## Safety and migration status

**No migration was applied and no database was altered by the Phase 3
implementation or the 24 November drift review.** Revision `0003` reached the
development database through the Docker backend's startup command, which runs
`alembic upgrade head` before Uvicorn. Verified read-only on 24 November 2026:

```text
cd backend
.\.venv\Scripts\alembic current
0003_phase3_intelligence (head)
.\.venv\Scripts\alembic check
No new upgrade operations detected.
```

`budgets`, `savings_goals`, `spending_preferences`, `forecasts` and
`financial_insights` exist and contain zero rows; the Phase 1 and Phase 2 tables
are unchanged. Rollback is available with `alembic downgrade 0002_phase2_financial`
but is currently lossless only because every Phase 3 table is empty — and it is
undone by the next backend restart unless the startup command changes.

Automatic migration on startup is convenient but bypasses owner approval. The
proposed safer workflow (not yet applied) is to remove `alembic upgrade head`
from the container command, migrate explicitly with a backup, and let the
application fail fast when the schema is behind.

Remaining blocker: the three PostgreSQL-only locking tests have not been re-run
because `guardian_test` is empty and executing them resets it. That needs
explicit approval.

## Security review

- Every Phase 3 query is scoped by the authenticated `user_id`; another user's
  budget, goal or insight resolves as `404`.
- Preferences are per user and unique on `user_id`.
- Reports, forecasts and summaries never include another user's records.
- No external service, exchange rate or model is called, so no financial data
  leaves the backend.
- Awareness is advisory: it neither moves money nor claims to intercept a
  payment.
- Insight descriptions embed stored merchant/description text; clients render
  it as text, not HTML.

## Not verified / known limitations

- **Native mobile runtime:** no device or emulator build was run; TypeScript is
  the only mobile check. Mobile has no automated test suite.
- **Notification delivery:** no email, push or SMS provider exists. Insights
  are stored and shown in-app only. `enable_post_payment_reminders` is stored
  but unused; awareness runs at transaction creation, not from a scheduler.
- **PostgreSQL-only tests not run:** the three `SELECT … FOR UPDATE` locking
  tests still need a `guardian_test` run, which creates and drops every table in
  that test database and therefore needs explicit approval.
- **Forecast persistence:** `forecasts` exists but the API computes on demand
  and stores nothing.
- **Income heuristic:** recurring detection is deterministic but can
  misclassify irregular income; the basis text discloses which rule was used.
- **Discretionary spending:** the forecast's `expected_expenses` covers known
  obligations only, not everyday spending.
- **Savings funding:** `current_amount` is manual; it is not derived from
  transactions.
- **Reports:** no PDF/CSV export and no scheduled delivery.
- **Money encoding:** typed endpoints return two-decimal strings; analytical
  `dict` endpoints return JSON numbers.
- **No browser automation** exercised the new screens in this pass; web
  coverage is component tests, type-check, lint and production build.

## Documentation

- [`docs/api/phase-3.md`](../docs/api/phase-3.md) — Phase 3 API reference.
- [`docs/database/schema.md`](../docs/database/schema.md) — Phase 3 tables and
  migration status.
- [`docs/architecture/overview.md`](../docs/architecture/overview.md) — Phase 3
  modules and flows.
- Root `README.md` — Phase 3 status, endpoints and checks.

## Phase 4 readiness

Phase 3 supplies the prerequisites for Phase 4:

- Deterministic calculations for income, expenses, forecasts and reports.
- `FinancialInsight` and `Forecast` tables for agent context.
- Controlled backend tools can wrap `IntelligenceService`, `SummaryService`,
  `BudgetService`, `SavingsGoalService` and `RecurringPaymentService`.
- Per-user isolation is enforced across every new endpoint.

No Phase 4 tables, endpoints, screens or AI behaviour have been added.
