# API Reference — Phase 3

Base URL: `http://localhost:8000/api/v1`

Interactive OpenAPI docs: `/docs` (disabled when `ENVIRONMENT=production`).

Phase 3 adds budgeting, savings goals, spending preferences and the
deterministic financial-intelligence engine (summaries, trends, forecasts,
risks, insights and monthly reports). Everything is computed from records
already stored in Phases 1–2. No AI model is called, no payment is executed and
no notification (email, push or SMS) is delivered.

## Conventions

The conventions in [`phase-2.md`](phase-2.md) still apply: bearer
authentication on every route below, the shared error shape
`{ "detail": …, "code": … }`, `404` for another user's records,
`NUMERIC(14,2)` storage, ISO dates and uppercase three-letter currency codes.

Phase 3 adds these rules:

- **One currency per calculation.** Every total, forecast, budget summary,
  savings summary and report is reported in the user's preferred currency
  (their account currency, `INR` when unset). Records in other currencies are
  listed in a `currency_breakdown` instead of being added to the total.
  **No exchange rate is applied anywhere.**
- **Projects are deterministic.** The same stored records and the same
  preferences produce the same output. Forecasts are computed on demand and
  are not stored snapshots.
- **Insights are advisory.** An insight never blocks a payment, never moves
  money and never claims interception.
- Money in typed responses (budgets, savings goals, preferences, insights) is
  a two-decimal **string**. Money inside the analytical `dict` responses
  (`/intelligence/*`) is serialised by the framework as a JSON number; treat it
  as a decimal value, not a float for arithmetic, and never round-trip it
  through binary floating point in a client.

### Status codes

The Phase 2 table applies. Phase 3 adds:

| Status | Code | Meaning |
|---|---|---|
| 409 | `budget_period_overlap` | A new or updated budget overlaps an existing active budget in the same category and currency |
| 400 | — | Missing `transaction_amount`, unsupported filter/date range |
| 404 | — | Budget, savings goal or insight not found or not owned by the caller |

## Budgets

A budget is a spending limit for a date range, optionally limited to one
category (`category_id: null` means overall spending). Only periods that
overlap are rejected; a budget whose range ends before another starts is
allowed.

### `GET /budgets`

Bearer required. Query parameters:

| Name | Type | Default | Notes |
|---|---|---|---|
| `is_active` | boolean | – | Filter by active flag |
| `category_id` | UUID | – | Filter by category |
| `include_spending` | boolean | `false` | Adds `spent`, `remaining`, `overspending`, `percent_used` to each item |
| `limit` | int | 50 | 1–200 |
| `offset` | int | 0 | ≥ 0 |

```json
{
  "items": [
    {
      "id": "…",
      "category_id": null,
      "name": "Monthly essentials",
      "period_start": "2026-11-01",
      "period_end": "2026-11-30",
      "amount": "40000.00",
      "currency": "INR",
      "alert_threshold": 80,
      "is_active": true,
      "period": "2026-11-01 to 2026-11-30",
      "created_at": "2026-11-20T10:00:00Z",
      "updated_at": "2026-11-20T10:00:00Z"
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

With `include_spending=true` each item also carries:

```json
{
  "spent": "15230.50",
  "remaining": "24769.50",
  "overspending": false,
  "percent_used": 38.08
}
```

### `POST /budgets`

Bearer required. Returns `201` with the created budget.

```json
{
  "name": "Monthly essentials",
  "period_start": "2026-11-01",
  "period_end": "2026-11-30",
  "amount": "40000.00",
  "currency": "INR",
  "category_id": null,
  "alert_threshold": 80,
  "is_active": true
}
```

- `amount` must be positive.
- `period_end` must be on or after `period_start`.
- `alert_threshold` is an integer percentage, 0–100, default `80`.
- `currency` defaults to the user's preferred currency.
- Overlapping an existing active budget returns `409 budget_period_overlap`.

### `GET /budgets/{budget_id}`

Bearer required. Returns one owned budget or `404`.

### `PATCH /budgets/{budget_id}`

Bearer required. Accepts any subset of the create fields. `category_id: null`
makes the budget overall. A change that would overlap another active budget
returns `409 budget_period_overlap`. Returns the updated budget.

### `DELETE /budgets/{budget_id}`

Bearer required. Deletes the budget and returns `204`.

### `GET /budgets/{budget_id}/spending`

Bearer required. Returns the spending summary for that budget.

```json
{
  "budget_id": "…",
  "name": "Monthly essentials",
  "period": "2026-11-01 to 2026-11-30",
  "amount": "40000.00",
  "currency": "INR",
  "spent": "15230.50",
  "remaining": "24769.50",
  "alert_threshold": 80,
  "overspending": false,
  "percent_used": 38.08
}
```

`spent` is the magnitude of expense transactions in the budget's currency and
period (optionally limited to its category). `remaining` never goes below zero
for display purposes; `overspending` is true when spending exceeds `amount`.

## Savings goals

### `GET /savings-goals`

Bearer required. Query: `is_active` (boolean), `limit` (1–200, default 50),
`offset` (≥ 0). Returns a page of goals.

```json
{
  "items": [
    {
      "id": "…",
      "name": "Emergency fund",
      "target_amount": "200000.00",
      "current_amount": "45000.00",
      "currency": "INR",
      "target_date": "2027-06-30",
      "is_active": true,
      "remaining": "155000.00",
      "percent_funded": 22.5,
      "created_at": "2026-11-20T10:00:00Z",
      "updated_at": "2026-11-20T10:00:00Z"
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

`remaining` and `percent_funded` are computed, not stored.

### `GET /savings-goals/summary`

Bearer required. Totals for active goals, reported per currency.

```json
{
  "currency": "INR",
  "total_target": "200000.00",
  "total_saved": "45000.00",
  "remaining": "155000.00",
  "goal_count": 1,
  "currency_breakdown": {
    "INR": {
      "total_target": "200000.00",
      "total_saved": "45000.00",
      "remaining": "155000.00",
      "goal_count": 1
    },
    "USD": {
      "total_target": "5000.00",
      "total_saved": "1200.00",
      "remaining": "3800.00",
      "goal_count": 1
    }
  }
}
```

Top-level totals cover `currency` only. Other currencies appear in
`currency_breakdown` and are never converted.

### `POST /savings-goals`

Bearer required. Returns `201`.

```json
{
  "name": "Emergency fund",
  "target_amount": "200000.00",
  "currency": "INR",
  "target_date": "2027-06-30",
  "is_active": true
}
```

`target_amount` must be positive. `current_amount` starts at `0.00` and is set
through `PATCH`; there is no automatic funding from transactions.

### `GET /savings-goals/{goal_id}`

Bearer required. Returns one owned goal or `404`.

### `PATCH /savings-goals/{goal_id}`

Bearer required. Accepts any subset of `name`, `target_amount`, `currency`,
`target_date`, `current_amount` and `is_active`. Returns the updated goal.

### `DELETE /savings-goals/{goal_id}`

Bearer required. Returns `204`.

## Spending preferences

One row per user, created on first read. These preferences drive proactive
awareness and the risk rules that use reminder timing.

### `GET /spending-preferences`

Bearer required.

```json
{
  "id": "…",
  "user_id": "…",
  "proactive_awareness_enabled": true,
  "significant_spending_threshold": "5000.00",
  "reminder_advance_days": 3,
  "enable_due_reminders": true,
  "enable_post_payment_reminders": true,
  "enable_entertainment_alerts": false,
  "entertainment_categories": "entertainment,dining",
  "reminder_frequency": "daily",
  "currency": "INR",
  "created_at": "2026-11-20T10:00:00Z",
  "updated_at": "2026-11-20T10:00:00Z"
}
```

### `PATCH /spending-preferences`

Bearer required. Accepts any subset of the fields above except `id`,
`user_id`, `created_at` and `updated_at`.

- `significant_spending_threshold` must be positive.
- `reminder_advance_days` is 0–30.
- `reminder_frequency` is `daily`, `weekly` or `none`.
- `entertainment_categories` is a comma-separated list of category slugs,
  maximum 200 characters.
- `proactive_awareness_enabled` defaults to `true`; entertainment alerts
  default to `false`.

Preferences are stored reliably and are read (never created) by read-only risk
detection. `enable_post_payment_reminders` is persisted, but no post-payment
scheduler exists yet: awareness currently runs when a transaction is recorded.
No push, email or SMS notification is sent.

## Financial intelligence

All routes below are bearer-scoped to the caller and report a single currency.

### `GET /intelligence/summary`

Query: `year` (2000–2100, default current year), `month` (1–12, default
current month). Calendar-month income, expenses and category breakdown.

```json
{
  "year": 2026,
  "month": 11,
  "period_start": "2026-11-01",
  "period_end": "2026-11-30",
  "currency": "INR",
  "income": 85000.00,
  "expenses": 34288.75,
  "net": 50711.25,
  "category_income": { "salary": 85000.00 },
  "category_expenses": { "rent": 25000.00, "groceries": 6120.25 },
  "transaction_count": 23,
  "currency_breakdown": {
    "INR": { "income": 85000.00, "expenses": 34288.75, "count": 23 },
    "USD": { "income": 0.00, "expenses": 120.00, "count": 1 }
  }
}
```

### `GET /intelligence/trends`

Query: `lookback_days` (30–730, default 90). Weekly expense totals and a trend
direction (`increasing`, `decreasing`, `stable`).

```json
{
  "lookback_days": 90,
  "since": "2026-08-25",
  "currency": "INR",
  "weekly_spending": { "2026-W35": 8120.00, "2026-W36": 7490.50 },
  "trend": "stable"
}
```

The trend compares the mean of the first half of the weeks with the mean of the
second half (more than +10% is increasing, more than −10% is decreasing) and is
`stable` with fewer than three weeks of data.

### `GET /intelligence/forecast`

Query: `days` (1–365, default 30). Projects the available balance forward using
unpaid bills, active subscriptions and detected recurring income.

```json
{
  "days": 30,
  "start_date": "2026-11-23",
  "end_date": "2026-12-23",
  "available_balance": "45120.75",
  "expected_income": "85000.00",
  "expected_expenses": "25499.00",
  "projected_balance": "104621.75",
  "starting_obligations": "25000.00",
  "upcoming_obligations": [
    {
      "kind": "bill",
      "id": "…",
      "name": "House rent",
      "amount": "25000.00",
      "due_date": "2026-11-23",
      "currency": "INR",
      "status": "due"
    }
  ],
  "daily_projection": [
    { "date": "2026-11-23", "projected_balance": "20120.75" },
    { "date": "2026-11-24", "projected_balance": "22954.08" }
  ],
  "currency": "INR",
  "income_basis": "Estimated from 1 recurring income source(s) detected in the last 90 days.",
  "income_sources": [
    {
      "name": "Acme Corp",
      "cadence_days": 30,
      "median_amount": "85000.00",
      "monthly_estimate": "85000.00",
      "occurrences": 3
    }
  ],
  "excluded_currencies": ["USD"],
  "assumptions": "Income: … Obligations: unpaid bills and active subscriptions due on or before 2026-12-23; overdue and due-today amounts are applied to the opening balance. Only INR records are included; accounts in USD are excluded because no exchange rate is applied. Figures are projections, not guarantees."
}
```

Rules and assumptions:

- `available_balance` sums `available_balance` of active accounts in the
  reporting currency only.
- `upcoming_obligations` are unpaid bills and active subscriptions due within
  the window in the reporting currency. `status` is `overdue`, `due` or
  `upcoming`.
- Overdue and due-today obligations are subtracted from the opening balance
  (`starting_obligations`), so the daily projection starts from what is still
  available after paying them.
- `daily_projection` has one entry per day from today to `end_date`, and its
  final entry equals `projected_balance` exactly.
- Income estimation: an income source is recurring when it appears at least
  twice in 90 days with a median cadence of 5–45 days and every amount within
  40% of the source's median amount. Its monthly estimate is
  `median × 30 / cadence`. With no recurring source, the estimate is the
  average monthly income over the 90-day history and `income_basis` says so.
  With no income history it is `0.00`. This is a heuristic, not a payslip
  schedule.
- `expected_expenses` is the sum of the obligations in the window; it does not
  model discretionary spending.
- Currencies other than the reporting currency are listed in
  `excluded_currencies` and are never converted.

### `GET /intelligence/reports`

Query: `year`, `month`. A monthly financial report computed on demand.

```json
{
  "year": 2026,
  "month": 11,
  "period_start": "2026-11-01",
  "period_end": "2026-11-30",
  "generated_at": "2026-11-23",
  "currency": "INR",
  "income": 85000.00,
  "expenses": 34288.75,
  "net": 50711.25,
  "savings_rate": 59.66,
  "transaction_count": 23,
  "category_breakdown": [
    { "category": "rent", "income": 0.00, "expenses": 25000.00, "share_percent": 72.91 }
  ],
  "top_merchants": [
    { "name": "Landlord", "amount": 25000.00, "count": 1 }
  ],
  "previous_period": {
    "year": 2026,
    "month": 10,
    "income": 85000.00,
    "expenses": 31000.00,
    "net": 54000.00
  },
  "change": {
    "income_percent": 0.0,
    "expenses_percent": 10.61,
    "net_percent": -6.09
  },
  "budgets": [],
  "savings": { "currency": "INR", "total_target": "200000.00", "total_saved": "45000.00", "remaining": "155000.00", "goal_count": 1, "currency_breakdown": {} },
  "currency_breakdown": {
    "INR": { "income": 85000.00, "expenses": 34288.75, "count": 23 }
  },
  "notes": [
    "Totals are reported in INR only.",
    "Amounts in other currencies are listed separately; no exchange rate is applied.",
    "A report is a record of stored transactions, not a tax document."
  ]
}
```

- `savings_rate` is `net / income × 100`, or `null` when income is zero.
- `change.*_percent` is `(current − previous) / |previous| × 100`, or `null`
  when the previous value is zero.
- `budgets` contains spending summaries for active budgets of that currency
  that overlap the month.
- `top_merchants` lists at most ten expense payees, largest first.
- Reports are generated from stored records on each request; nothing is saved
  as a report snapshot and no PDF/file export exists.

### `GET /intelligence/risks`

Bearer required. Returns the current risk list without persisting it.

```json
[
  {
    "insight_type": "low_balance",
    "severity": "critical",
    "title": "Projected insufficient balance",
    "description": "Your projected balance after upcoming obligations is INR -1250.00. You may not have enough to cover upcoming dues.",
    "amount": -1250.00,
    "currency": "INR",
    "related_date": "2026-12-23"
  }
]
```

Rules include: projected balance below zero (`critical`) or below 20% of
upcoming obligations (`warning`), overdue bills (`critical`), bills due within
`reminder_advance_days` (`warning`), a week's spending above 150% of the
90-day weekly average, budget overspend warnings, and unreviewed recurring
payments.

### `POST /intelligence/insights`

Bearer required. Runs risk detection, persists new insights and returns `201`
with the created insights. Duplicate signatures (type, title, related date) are
not stored twice.

### `GET /intelligence/insights`

Query: `insight_type` (`low_balance`, `unusual_spending`,
`upcoming_obligation`, `overspending_budget`, `unreviewed_recurring`,
`spending_trend`, `significant_spending`, `entertainment_spending`,
`duplicate_transaction`), `severity` (`info`, `warning`, `critical`),
`is_dismissed` (boolean), `limit` (1–200, default 50), `offset`.

```json
{
  "items": [
    {
      "id": "…",
      "insight_type": "significant_spending",
      "severity": "warning",
      "title": "Large expense: Landlord",
      "description": "…",
      "amount": "25000.00",
      "currency": "INR",
      "related_date": "2026-11-23",
      "is_dismissed": false,
      "created_at": "2026-11-23T10:00:00Z",
      "updated_at": "2026-11-23T10:00:00Z"
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

### `PATCH /intelligence/insights/{insight_id}/dismiss`

Bearer required. Marks the insight dismissed and returns `204`. An unknown or
unowned insight returns `404`.

### `POST /intelligence/proactive-awareness`

Bearer required. The pre-transaction check used by the web and mobile manual
entry forms.

```json
{
  "transaction_amount": "-12500.00",
  "transaction_category": "shopping"
}
```

`transaction_amount` is required; only its magnitude is used. Returns `null`
when proactive awareness is disabled or the amount is below
`significant_spending_threshold`. Otherwise:

```json
{
  "significant_spending": true,
  "transaction_amount": 12500.00,
  "currency": "INR",
  "available_balance": 45120.75,
  "remaining_after_spending": 32620.75,
  "upcoming_dues": [
    { "kind": "bill", "id": "…", "name": "House rent", "amount": 25000.00, "due_date": "2026-12-05", "currency": "INR", "status": "upcoming" }
  ],
  "upcoming_total": 25499.00,
  "insufficient_after_spending": false,
  "advice": "After this spending, you would have INR 32620.75 available against 25499.00 in upcoming obligations."
}
```

This endpoint is advisory. It does not reserve money, block the transaction or
claim that a payment was intercepted.

### Transaction creation alerts

`POST /transactions` (Phase 2) now also runs spending awareness after storing a
manual transaction. Its response includes `alerts`:

```json
{
  "id": "…",
  "amount": "-12500.00",
  "currency": "INR",
  "alerts": [
    {
      "id": "…",
      "insight_type": "significant_spending",
      "severity": "warning",
      "title": "Large expense: Landlord",
      "description": "…",
      "amount": "12500.00",
      "currency": "INR",
      "related_date": "2026-11-23",
      "is_dismissed": false,
      "created_at": "2026-11-23T10:00:00Z",
      "updated_at": "2026-11-23T10:00:00Z"
    }
  ]
}
```

`alerts` is empty for list and detail responses. Alerts are persisted insights
that appear on the Intelligence screen; they are not delivered notifications.

A blocked duplicate (`409 duplicate_transaction`) also records a
`duplicate_transaction` insight before raising the conflict, so repeated
accidental entries are reviewable. No transaction row is created for the
blocked attempt.

## Currency behaviour

| Endpoint group | Behaviour |
|---|---|
| `GET /summary` | Totals cover the user's preferred currency; `currency_breakdown` has one entry per currency |
| `GET /intelligence/summary` | Same, plus a per-currency income/expense/count breakdown |
| `GET /intelligence/trends` | Reporting currency only |
| `GET /intelligence/forecast` | Reporting currency only; others listed in `excluded_currencies` |
| `GET /intelligence/reports` | Reporting currency only; others listed in `currency_breakdown` |
| `GET /savings-goals/summary` | Preferred-currency totals plus `currency_breakdown` |

Budgets and savings goals keep their own currency. A budget only measures
transactions in that currency.

## Out of scope for Phase 3

- AI/LLM analysis, chat, recommendations and generated narratives (Phase 4).
- Payment execution, transfers or automatic bill payment.
- Notification delivery (email, push, SMS, in-app push) and background
  schedulers. Preferences are stored; delivery is a later phase.
- Currency conversion and consolidated cross-currency totals.
- Persisted forecast snapshots, report exports (PDF/CSV) and scheduled reports.
- Automatic savings-goal funding.
