# API Reference — Phase 2

Base URL: `http://localhost:8000/api/v1`

Interactive OpenAPI docs: `/docs` (disabled when `ENVIRONMENT=production`).

Phase 2 adds consent-based banking, accounts, transactions, bills,
subscriptions and a unified financial overview on top of the Phase 1
authentication contract. It does not execute payments or call an AI service.

## Conventions

- JSON request and response bodies.
- Every Phase 2 route except `GET /banking/providers` requires
  `Authorization: Bearer <access_token>`. Phase 1 authentication endpoints are
  documented in `docs/api/phase-1.md`.
- Errors use the shared shape:

```json
{ "detail": "Human-readable message", "code": "machine_code" }
```

Validation errors add a safe `errors` array. Submitted values are never echoed.

- All financial records are scoped to the authenticated user. Requesting another
  user's connection, account, transaction, bill or subscription returns `404`,
  not `403`, so resource existence is not disclosed.
- Money is stored as `NUMERIC(14,2)` and serialised as a **string with exactly
  two decimal places**, for example `"25000.00"`. It is never serialised as a
  binary float.
- Transaction amounts are **signed**: positive = income/refund, negative =
  expense. Bill, subscription and payment amounts must be **positive**.
- Dates are ISO `YYYY-MM-DD`. Timestamps are ISO 8601 with an offset (UTC in
  practice).
- Currency codes are three alphabetic characters and are stored uppercase.
  Obligations default to the user's preferred currency (`INR` when unset).
  A manual transaction must match the currency of its account.
- List endpoints return either a page object
  (`items`, `total`, `limit`, `offset`) or a plain array, as documented below.

### Status codes

| Status | Meaning |
|---|---|
| 400 | Bad request (unsupported filter, date range, currency mismatch, unknown provider, provider error) |
| 401 | Missing, invalid, expired or revoked authentication |
| 403 | Disabled account |
| 404 | Resource not found or not owned by the caller |
| 409 | Business-rule conflict (duplicate, revoked/expired consent, inactive account, non-payable obligation) |
| 422 | Validation failure |
| 429 | Authentication rate limit exceeded (auth endpoints only) |
| 500 | Unexpected error; details are not exposed |

Business-rule `409` responses carry a specific `code`:

| Code | Meaning |
|---|---|
| `connection_limit_reached` | The user already has the maximum of 10 connections |
| `connection_revoked` | The connection's consent was revoked |
| `consent_revoked` | No active consent remains for the connection |
| `consent_expired` | The consent expiry time has passed |
| `account_inactive` | The account is deactivated (for example after revocation) |
| `duplicate_transaction` | A matching manual transaction already exists |
| `provider_transaction` | Provider-synced transactions cannot be deleted |
| `bill_not_payable` | The bill is `cancelled` or `skipped` |
| `already_paid` | A one-off bill is already paid |
| `payment_already_recorded` | A payment for that bill/subscription was already recorded on that date |
| `subscription_not_active` | Only active subscriptions accept new payments |
| `bad_status` | Unsupported subscription status filter |

## Banking

### `GET /banking/providers`

Public. Lists registered financial-data providers and their institutions.

```json
[
  {
    "slug": "mock",
    "display_name": "Mock Bank (development)",
    "is_mock": true,
    "institutions": [
      {
        "id": "mock-hdfc",
        "name": "HDFC Bank (Demo)",
        "country": "IN",
        "is_mock": true
      }
    ]
  }
]
```

Only the mock provider is bundled in Phase 2. Its connections, accounts and
transactions are flagged `is_mock: true` in every response.

### `POST /banking/connections`

Bearer required. Creates a consent record with the provider, stores an opaque
provider reference (never a banking password, PIN, OTP or card security code),
and immediately runs an initial synchronisation.

Request:

```json
{
  "institution_id": "mock-hdfc",
  "provider": "mock"
}
```

`provider` is optional and defaults to `BANK_PROVIDER` (`mock`).

Response `201`:

```json
{
  "connection": {
    "id": "…",
    "provider": "mock",
    "institution_id": "mock-hdfc",
    "institution_name": "HDFC Bank (Demo)",
    "status": "active",
    "is_mock": true,
    "last_synced_at": "2026-11-20T10:00:00Z",
    "last_error": null,
    "created_at": "2026-11-20T10:00:00Z",
    "accounts": [
      {
        "id": "…",
        "connection_id": "…",
        "name": "Everyday Checking",
        "account_type": "checking",
        "currency": "INR",
        "balance": "48250.75",
        "available_balance": "45120.75",
        "is_active": true,
        "is_mock": true,
        "last_synced_at": "2026-11-20T10:00:00Z",
        "created_at": "2026-11-20T10:00:00Z"
      }
    ],
    "consents": [
      {
        "id": "…",
        "status": "active",
        "scopes": "accounts,transactions",
        "granted_at": "2026-11-20T10:00:00Z",
        "expires_at": "2027-02-18T10:00:00Z",
        "revoked_at": null
      }
    ]
  },
  "sync_job": {
    "id": "…",
    "connection_id": "…",
    "status": "succeeded",
    "started_at": "2026-11-20T10:00:00Z",
    "finished_at": "2026-11-20T10:00:01Z",
    "accounts_synced": 2,
    "transactions_created": 49,
    "transactions_skipped": 1,
    "error_message": null
  }
}
```

`sync_job` is `null` only if no job was produced. Errors:

- `400 unknown_provider` or `400 provider_error`.
- `409 connection_limit_reached` after 10 connections.

### `GET /banking/connections`

Bearer required. Returns the caller's connections, newest first, each with its
accounts and consents.

### `GET /banking/connections/{connection_id}`

Bearer required. Returns one connection with accounts and consents, or `404`.

### `DELETE /banking/connections/{connection_id}`

Bearer required. Revokes consent, marks the connection `revoked`, deactivates
its accounts and asks the provider to revoke access. Local revocation succeeds
even if the provider call fails. Returns `204`.

### `POST /banking/connections/{connection_id}/sync`

Bearer required. Runs synchronisation and returns the `SyncJob`.

- First sync: transactions from the last `BANK_SYNC_LOOKBACK_DAYS` days
  (default 120).
- Later syncs: from three days before the previous sync.
- Provider transactions are deduplicated per account by
  `sha256(account_id:external_id)`.
- Job `status` is `succeeded`, `partial` (some accounts failed) or `failed`
  (all account retrieval failed). `error_message` contains a generic,
  client-safe description; provider details are logged server-side.

Errors: `409 connection_revoked`, `409 consent_revoked` or `409 consent_expired`.
An expired consent also marks the connection `expired` and records
`last_error: "Consent expired"`.

### `GET /banking/sync-jobs`

Bearer required. Query parameters:

| Name | Type | Default | Notes |
|---|---|---|---|
| `connection_id` | UUID | – | Restricts to one owned connection |
| `limit` | int | 20 | 1–50 |

Returns `SyncJob` objects, newest first. An unknown or unowned `connection_id`
returns `404`.

### `GET /banking/sync-jobs/{job_id}`

Bearer required. Returns one owned sync job or `404`.

## Accounts

### `GET /accounts`

Bearer required. Query: `active_only` (boolean, default `true`). Returns active
accounts ordered by creation time. Revoked connections deactivate their
accounts, so they disappear unless `active_only=false` is requested.

```json
[
  {
    "id": "…",
    "connection_id": "…",
    "name": "Everyday Checking",
    "account_type": "checking",
    "currency": "INR",
    "balance": "48250.75",
    "available_balance": "45120.75",
    "is_active": true,
    "is_mock": true,
    "last_synced_at": "2026-11-20T10:00:00Z",
    "created_at": "2026-11-20T10:00:00Z"
  }
]
```

### `GET /accounts/{account_id}`

Bearer required. Returns one owned account or `404`.

## Transactions

### `GET /transactions/categories`

Bearer required. Returns the shared system categories. Phase 2 has no
user-defined category API, so this is the full list available to the caller.

```json
[
  { "id": "…", "slug": "salary", "name": "Salary", "kind": "income", "is_system": true }
]
```

System category slugs: `salary`, `refund`, `rent`, `utilities`, `groceries`,
`dining`, `transport`, `travel`, `shopping`, `entertainment`, `health`,
`education`, `fees`, `transfer`, `other`.

### `GET /transactions`

Bearer required. Returns a `TransactionPage`:

```json
{
  "items": [
    {
      "id": "…",
      "account_id": "…",
      "account": { "id": "…", "name": "Everyday Checking", "account_type": "checking" },
      "category": { "id": "…", "slug": "salary", "name": "Salary", "kind": "income", "is_system": true },
      "amount": "85000.00",
      "currency": "INR",
      "description": "Salary credit - Acme Corp",
      "merchant": "Acme Corp",
      "occurred_on": "2026-11-01",
      "transaction_type": "income",
      "source": "provider",
      "is_pending": false,
      "notes": null,
      "created_at": "2026-11-20T10:00:00Z"
    }
  ],
  "total": 49,
  "limit": 50,
  "offset": 0
}
```

Filters:

| Name | Notes |
|---|---|
| `account_id` | UUID |
| `category_id` | UUID |
| `transaction_type` | `income`, `expense` or `transfer` |
| `from_date`, `to_date` | Inclusive ISO dates |
| `search` | Case-insensitive match on description or merchant |
| `source` | `provider` or `manual` |
| `limit` | 1–200, default 50 |
| `offset` | ≥ 0, default 0 |

`400` when `from_date > to_date` or when `transaction_type`/`source` is not one
of the allowed values. Results are ordered by date then creation time, newest
first.

### `POST /transactions`

Bearer required. Records a manual transaction and returns it with `201`.

```json
{
  "account_id": "…",
  "amount": "-1250.50",
  "currency": "INR",
  "description": "Electricity bill",
  "merchant": "State Power",
  "occurred_on": "2026-11-20",
  "category_id": null,
  "notes": "November",
  "allow_duplicate": false
}
```

Rules:

- `amount` must be non-zero and within `NUMERIC(14,2)`.
- `currency` is optional; when supplied it must equal the account currency,
  otherwise `400 currency_mismatch`.
- `transaction_type` is derived from the sign (`income` or `expense`).
- When `category_id` is omitted, a deterministic keyword rule assigns a category,
  falling back to `other`.
- Duplicate detection uses the account, date, amount, description and merchant.
  A match returns `409 duplicate_transaction` unless `allow_duplicate` is true.
- An inactive account returns `409 account_inactive`; an unknown account returns
  `404`.

### `GET /transactions/{transaction_id}`

Bearer required. Returns one owned transaction or `404`.

### `PATCH /transactions/{transaction_id}`

Bearer required. Accepts any subset of `category_id`, `merchant` and `notes`.
Passing `category_id: null` clears the category. An inaccessible category
returns `404`. Works for provider-synced and manual transactions.

### `DELETE /transactions/{transaction_id}`

Bearer required. Deletes a **manual** transaction and returns `204`. A
provider-synced transaction returns `409 provider_transaction`; annotate or
recategorise it instead.

## Bills

A bill is a one-off or recurring obligation. Its stored `status` is `unpaid`,
`paid`, `skipped` or `cancelled`. Responses also include a computed `state`:

- `paid`, `skipped` or `cancelled` when that is the stored status.
- `overdue` when `unpaid` and `due_date < today`.
- `due` when `unpaid` and `due_date == today`.
- `upcoming` when `unpaid` and `due_date > today`.

### `GET /bills`

Bearer required. Returns a `BillPage`.

| Name | Default | Notes |
|---|---|---|
| `state` | – | `all`, `upcoming`, `overdue`, `due`, `unpaid`, `paid`, `skipped`, `cancelled` |
| `days` | 30 | Used by `state=upcoming`; 1–365 |
| `search` | – | Case-insensitive match on name or payee |
| `limit` | 50 | 1–200 |
| `offset` | 0 | ≥ 0 |

An unsupported `state` returns `400`. `state=all` removes the state filter.
Ordered by due date, then creation time.

### `POST /bills`

Bearer required. Returns the created bill with `201`.

```json
{
  "name": "House rent",
  "payee": "Landlord",
  "amount": "25000.00",
  "currency": "INR",
  "due_date": "2026-12-05",
  "recurrence": "monthly",
  "autopay": false,
  "reminder_days_before": 3,
  "category_id": null,
  "notes": null
}
```

- `amount` must be positive.
- `recurrence`: `none`, `weekly`, `monthly`, `quarterly` or `yearly`.
- `reminder_days_before`: 0–60, default 3.
- `currency` defaults to the user's preferred currency.
- New bills start as `unpaid`.

### `GET /bills/{bill_id}`

Bearer required. Returns one owned bill or `404`.

### `PATCH /bills/{bill_id}`

Bearer required. Accepts any subset of the create fields plus `status`
(`unpaid`, `paid`, `skipped`, `cancelled`). Setting `status` to `paid` records
`last_paid_at` if it was empty. Returns the updated bill.

### `DELETE /bills/{bill_id}`

Bearer required. Deletes the bill and its payment history, returning `204`.

### `POST /bills/{bill_id}/pay`

Bearer required. Records a payment and returns the updated bill.

```json
{
  "paid_on": "2026-11-20",
  "amount": "25000.00",
  "note": "November rent"
}
```

- Send `{}` when no overrides are needed; all body fields are optional.
  `paid_on` defaults to today and `amount` defaults to the bill amount.
- A one-off bill becomes `paid`.
- A recurring bill keeps `unpaid` and advances `due_date` to the first
  occurrence after `max(today, paid_on)`.
- `409 bill_not_payable` for `cancelled`/`skipped`; `409 already_paid` for an
  already-paid one-off bill; `409 payment_already_recorded` when a payment for
  this bill already exists on `paid_on`.

### `GET /bills/{bill_id}/payments`

Bearer required. Returns payment history, newest first.

```json
[
  {
    "id": "…",
    "bill_id": "…",
    "subscription_id": null,
    "amount": "25000.00",
    "currency": "INR",
    "paid_on": "2026-11-20",
    "note": "November rent",
    "created_at": "2026-11-20T10:00:00Z"
  }
]
```

## Subscriptions

### `GET /subscriptions`

Bearer required. Returns a `SubscriptionPage`.

| Name | Default | Notes |
|---|---|---|
| `status` | – | `active`, `paused` or `cancelled` |
| `days` | – | When set, only active subscriptions with a next payment on or before `today + days` (1–365); overdue active items are included |
| `search` | – | Case-insensitive match on name or provider |
| `limit` | 50 | 1–200 |
| `offset` | 0 | ≥ 0 |

An unsupported status returns `409 bad_status`. Ordered by next payment date,
then creation time.

Each item includes a computed `monthly_equivalent` string (weekly × 52 / 12,
quarterly ÷ 3, yearly ÷ 12, monthly unchanged).

```json
{
  "id": "…",
  "name": "Netflix",
  "provider": "Netflix",
  "amount": "649.00",
  "currency": "INR",
  "billing_cycle": "monthly",
  "next_payment_date": "2026-12-18",
  "started_on": "2026-01-18",
  "status": "active",
  "monthly_equivalent": "649.00",
  "reminder_days_before": 3,
  "notes": null,
  "category_id": null,
  "created_at": "2026-11-20T10:00:00Z",
  "updated_at": "2026-11-20T10:00:00Z"
}
```

### `POST /subscriptions`

Bearer required. Returns `201`.

```json
{
  "name": "Netflix",
  "provider": "Netflix",
  "amount": "649.00",
  "currency": "INR",
  "billing_cycle": "monthly",
  "next_payment_date": "2026-12-18",
  "started_on": "2026-01-18",
  "reminder_days_before": 3,
  "category_id": null,
  "notes": null
}
```

- `amount` must be positive.
- `billing_cycle`: `weekly`, `monthly`, `quarterly` or `yearly`; default
  `monthly`.
- `currency` defaults to the user's preferred currency.
- New subscriptions start as `active`.

### `GET /subscriptions/{subscription_id}`

Bearer required. Returns one owned subscription or `404`.

### `PATCH /subscriptions/{subscription_id}`

Bearer required. Accepts any subset of the create fields plus `status`
(`active`, `paused`, `cancelled`). Pausing or cancelling does not delete
history. Returns the updated subscription.

### `DELETE /subscriptions/{subscription_id}`

Bearer required. Deletes the subscription and its payment history, returning
`204`.

### `POST /subscriptions/{subscription_id}/pay`

Bearer required. Records a payment and returns the updated subscription.

```json
{
  "paid_on": "2026-11-20",
  "amount": "649.00",
  "note": "November"
}
```

- Send `{}` when no overrides are needed; all body fields are optional.
  `paid_on` defaults to today and `amount` to the subscription amount.
- Only `active` subscriptions accept payments (`409 subscription_not_active`).
- A second payment on the same date returns `409 payment_already_recorded`.
- `next_payment_date` advances to the first occurrence after
  `max(today, paid_on)`.

### `GET /subscriptions/{subscription_id}/payments`

Bearer required. Returns payment history, newest first, using the same
`PaymentRead` shape as bills.

## Overview

### `GET /summary`

Bearer required. Query: `days` (1–365, default 30). Returns the dashboard
summary.

```json
{
  "currency": "INR",
  "total_balance": "42470.88",
  "total_available": "42000.00",
  "accounts_count": 2,
  "connected_accounts_count": 1,
  "is_mock_data": true,
  "month_income": "85000.00",
  "month_expenses": "34288.75",
  "net_this_month": "50711.25",
  "upcoming_total": "25499.00",
  "upcoming_bills_count": 1,
  "upcoming_subscriptions_count": 1,
  "upcoming_payments": [],
  "recent_transactions": [],
  "last_synced_at": "2026-11-20T10:00:00Z"
}
```

- `total_balance` and `total_available` sum active accounts.
- `month_income` and `month_expenses` use the current calendar month and
  positive magnitudes for expenses.
- `upcoming_*` reflect the same window as `GET /upcoming`.
- `recent_transactions` contains up to six transactions.
- `is_mock_data` is true when any active account is mock.
- The summary does **not** convert between currencies; it adds the stored
  balances as-is and reports the user's preferred currency. See the known
  limitations in `phases/PHASE_2_PROGRESS.md`.

### `GET /upcoming`

Bearer required. Query: `days` (1–365, default 30). Returns unpaid bills and
active subscriptions due on or before `today + days`, sorted by due date.
Overdue items are included. `status` is computed from the due date for both
kinds: `overdue` before today, `due` today, otherwise `upcoming`.

```json
[
  {
    "kind": "bill",
    "id": "…",
    "name": "House rent",
    "amount": "25000.00",
    "currency": "INR",
    "due_date": "2026-12-05",
    "status": "upcoming",
    "autopay": false,
    "is_recurring": true
  }
]
```

### `GET /recurring-payments`

Bearer required. Returns deterministic, rule-based suggestions from stored
transactions. It never creates a bill or subscription automatically.

| Name | Default | Notes |
|---|---|---|
| `lookback_days` | 180 | 30–730 |
| `min_occurrences` | 2 | 2–12 |

```json
[
  {
    "merchant": "Netflix",
    "cadence": "monthly",
    "average_amount": "649.00",
    "currency": "INR",
    "occurrences": 4,
    "last_seen_on": "2026-11-18",
    "next_expected_on": "2026-12-18",
    "confidence": 0.86,
    "matched_subscription_id": "…",
    "matched_bill_id": null,
    "sample_transaction_ids": ["…"]
  }
]
```

Detection only considers expenses (not income or transfers), groups by merchant
or description, requires a stable interval and requires each amount to stay
within 25% of the group average. `matched_*` is informational and is based on a
case-insensitive name match with an existing record.

## Consent and synchronisation behaviour

1. `POST /banking/connections` records consent scopes and an expiry, then runs a
   first synchronisation. Only accounts and transactions visible under that
   consent are requested.
2. Provider records are validated (identifier, currency, account type, finite
   amounts within range, transaction dates no more than one day ahead) before
   storage.
3. Accounts are upserted per `(connection_id, external_id)`. Transactions are
   deduplicated per account by provider external ID.
4. `DELETE /banking/connections/{id}` revokes consent and deactivates accounts.
   Subsequent sync attempts fail with `409`. Deactivated accounts are hidden by
   the default `active_only=true` account listing.
5. When the consent expiry passes, sync marks the consent `expired` and the
   connection `expired`, then returns `409 consent_expired`. The user must
   reconnect to continue.
6. Sync jobs record `accounts_synced`, `transactions_created`,
   `transactions_skipped`, status and a safe error message, and are visible via
   `/banking/sync-jobs`.

## Out of scope for Phase 2

- Executing real payments or transfers.
- Real bank credentials or a live provider adapter (only the mock provider is
  bundled).
- AI analysis, forecasts, chat, approvals and notifications (Phases 3–6).
- Currency conversion and multi-currency consolidation.
