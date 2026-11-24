# Phase 2 — Bank Integration and Financial Data Management

**Status:** Implemented on 20 November 2026 and re-verified by the final closure
audit on 21 November 2026, with the explicit limitations listed below. Phase 3
has not been started.

**Final verdict:** PASS WITH LIMITATIONS (no blocking defect; the limitations
below are explicit and accepted).

**Branch:** `feature/phase-1-foundation` (Phase 2 changes are uncommitted work on
top of Phase 1 commit `d55ca0e`).

**Verified on:** 21 November 2026

Phase 2 establishes the financial data foundation: a provider adapter and
consent-based connections, synchronised accounts and transactions, manual
transaction entry with deduplication, bill and subscription management, payment
history, upcoming payments and a dashboard summary. The only bundled provider is
the clearly labelled mock provider. No payment is executed and no AI, forecast
or autonomous behaviour is included.

## Requirement checklist

### Bank integration

| Requirement | Status | Notes |
|---|---|---|
| Bank provider adapter | Complete | `BankProvider` interface with institutions, authorize, revoke, accounts and transactions |
| Mock bank provider | Complete | Deterministic demo data, four institutions, `is_mock` end to end |
| Bank connection workflow | Complete | Create connection, store opaque reference, run initial sync |
| Consent management | Complete | Scopes, granted/expiry timestamps, status, revocation |
| Account information retrieval | Complete | Accounts upserted per connection and external ID |
| Transaction synchronisation | Complete | Per-account retrieval, validation, categorisation, dedupe |
| Synchronisation status | Complete | `SyncJob` status, counts, errors; connection last sync/error |
| Error handling | Complete | Provider, validation and per-account failures produce safe job status |
| Consent expiry handling | Complete | Expired consent marks consent/connection expired and blocks sync with `409` |
| Consent revocation | Complete | Revokes consent, deactivates accounts, blocks future sync |

### Transaction management

| Requirement | Status | Notes |
|---|---|---|
| Transaction retrieval | Complete | `GET /transactions` with filters and pagination |
| Transaction storage | Complete | Provider and manual rows, signed amounts |
| Transaction categorisation | Complete | 15 system categories; deterministic keyword rules; user override |
| Transaction filtering | Complete | Account, category, type, date range, search, source, page |
| Transaction history | Complete | Ordered history, pagination, dashboard recent list |
| Duplicate detection | Complete | Unique `(account_id, dedupe_key)`; provider and manual keys |
| Income identification | Complete | Positive amounts, `income` type, provider type honoured |
| Expense identification | Complete | Negative amounts, `expense` type, provider type honoured |
| Manual transaction entry | Complete | Create, edit category/merchant/notes, delete manual rows |

### Bill management

| Requirement | Status | Notes |
|---|---|---|
| Bill creation | Complete | Name, payee, amount, currency, due date, recurrence, reminder |
| Bill editing | Complete | Partial update including status |
| Bill deletion | Complete | Cascades the bill's payment history |
| Due-date management | Complete | Create/update; recurring payments advance the due date |
| Payment status | Complete | Stored `unpaid`/`paid`/`skipped`/`cancelled` plus computed due state |
| Upcoming bill identification | Complete | `state=upcoming`, `/upcoming`, dashboard due list |
| Recurring bill management | Complete | Weekly/monthly/quarterly/yearly schedules advance on payment |

### Subscription management

| Requirement | Status | Notes |
|---|---|---|
| Subscription identification | Complete | Rule-based recurring suggestions from transactions; user confirms |
| Subscription creation | Complete | Name, provider, amount, cycle, next date, reminder |
| Subscription editing | Complete | Partial update, pause and cancel |
| Subscription history | Complete | Payment history endpoint and UI |
| Recurring payment tracking | Complete | Payment records and next-date advancement |
| Subscription reminders | Partial | Reminder lead time is stored, editable and displayed; no notification delivery exists |

### Frontend screens

| Requirement | Status | Notes |
|---|---|---|
| Bank connection screen | Complete | Web `/accounts`; mobile Accounts tab |
| Connected accounts screen | Complete | Web `/accounts`; mobile Accounts tab |
| Transaction dashboard | Complete | Web `/dashboard` and `/transactions`; mobile Home and Activity |
| Transaction details | Complete | Web detail/edit panel; mobile list and edit form |
| Bill management | Complete | Web `/bills`; mobile Payments tab |
| Subscription management | Complete | Web `/subscriptions`; mobile Payments tab |
| Upcoming payments calendar | Complete | Web `/upcoming`; mobile Payments agenda. Dated lists, not a month grid |
| Synchronisation status | Complete | Connection status, last sync/error and per-sync counts; no dedicated history screen |

### Database entities

| Entity | Status | Migration table |
|---|---|---|
| Bank connections | Complete | `bank_connections` |
| Bank consents | Complete | `bank_consents` |
| Financial accounts | Complete | `financial_accounts` |
| Transactions | Complete | `transactions` |
| Transaction categories | Complete | `transaction_categories` |
| Bills | Complete | `bills` |
| Subscriptions | Complete | `subscriptions` |
| Synchronisation jobs | Complete | `sync_jobs` |

Additional table: `payments`, which stores bill and subscription payment history.
All Phase 2 tables carry a `user_id` owner with `ON DELETE CASCADE` to `users`,
except the shared system rows in `transaction_categories` (`user_id IS NULL`).

### Completion criteria

| Criterion | Status | Evidence |
|---|---|---|
| Users can view connected accounts | Met | `GET /accounts`, connection cards, live smoke checks |
| Transactions retrieved/loaded from mock providers | Met | Initial sync created 49 transactions in the 21 November closure run (count varies with the mock data window) |
| Duplicate transactions prevented | Met | `409 duplicate_transaction`; sync skips existing keys |
| Bills and subscriptions managed | Met | CRUD, pay and history verified in tests and live checks |
| Synchronisation status visible | Met | Connection status, last sync, last error, job counts |
| Records associated with owners | Met | Cross-user bill/connection/transaction requests returned `404` |
| Consent revocation blocks sync | Met | Revoke `204`; sync after revocation `409`; accounts hidden |

## Verification evidence

### Backend — SQLite

```text
cd backend
.\.venv\Scripts\python -m pytest -q
113 passed, 3 skipped, 1 warning in 44.10s
```

The three skips are PostgreSQL-only concurrency tests that require
`SELECT ... FOR UPDATE`.

Coverage includes Phase 1 authentication and Phase 2 banking, accounts,
transactions, bills, subscriptions, overview, ownership isolation, consent
revocation and expiry, deduplication, schedule advancement, rate limiting,
refresh-token delivery and disabled-account sessions.

### Backend — PostgreSQL

```text
cd backend
$env:TEST_DATABASE_URL = "postgresql+psycopg://<user>:<password>@localhost:5432/guardian_test"
.\.venv\Scripts\python -m pytest -q
116 passed, 1 warning in 48.17s
```

The PostgreSQL run executes the three concurrency tests skipped on SQLite. The
test configuration rejects any `TEST_DATABASE_URL` that does not end in `_test`.

### Database migration consistency

```text
cd backend
.\.venv\Scripts\alembic current
0002_phase2_financial (head)

.\.venv\Scripts\alembic check
No new upgrade operations detected.
```

### Web

```text
cd frontend/web
npm test -- --run
7 test files, 36 tests passed

npm run lint
1 warning: AuthContext.tsx:186 react(only-export-components)

npm run build
Succeeds; production HTML, CSS and JS bundle emitted
```

The warning is the existing Fast Refresh only-export-components warning from
Phase 1. It does not affect behaviour, tests or the production build. The web
suite includes the new `AppShell` navigation test and all Phase 1 auth and route
tests.

### Mobile

```text
cd mobile
npx tsc --noEmit
```

Passes with no diagnostics.

### Live Docker API smoke and integration

The backend and PostgreSQL containers were started with Docker Compose. Health:

```json
{"status":"ok","database":"ok","version":"1.0.0","environment":"development"}
```

A live script exercised the running API end to end. Result: **24 passed, 0
failed**.

| Check | Result |
|---|---|
| Register user A | PASS |
| List providers | PASS (`providers=1`) |
| Create connection and initial sync | PASS (`succeeded`, 49 created, 0 skipped) |
| List accounts | PASS (`accounts=2`) |
| List transactions | PASS (`total=49`) |
| Create manual transaction | PASS (`type=expense`) |
| Duplicate transaction blocked | PASS (`409`) |
| Explicit duplicate allowed | PASS (`201`) |
| Transaction filtering | PASS (`total=2`) |
| Create bill | PASS (`state=upcoming`) |
| Upcoming bills | PASS (`total=1`) |
| Bill payment, history and schedule advance | PASS (next `2026-12-26`, history 1) |
| Same-day bill payment blocked | PASS (`409`) |
| Create subscription | PASS (`monthly=499.00`) |
| Subscription payment, history and advance | PASS (next `2026-12-24`, history 1) |
| Dashboard summary | PASS (balance `43438.42`, income `85000.00`, expenses `39725.87`) |
| Upcoming payments | PASS (`items=2`) |
| Recurring detection | PASS (`suggestions=6`) |
| Ownership isolation: bill | PASS (`404`) |
| Ownership isolation: connection | PASS (`404`) |
| Ownership isolation: transaction | PASS (`404`) |
| Revoke connection | PASS (`204`) |
| Sync blocked after revocation | PASS (`409`) |
| Revoked accounts hidden | PASS (`active=0`) |

Amounts and counts in this table are a snapshot of the 21 November closure run.
The mock provider derives its transactions from the current calendar date, so
the exact created/skipped and balance figures vary between runs.

### Phase 1 regression

- The full Phase 1 backend test files still pass in both database runs.
- All 36 web tests, including auth, route guards and session restore, pass.
- The production web build and mobile type-check pass.
- No Phase 1 API contract, migration or security behaviour was changed.

## Final closure audit — 21 November 2026

An independent read-only review of the Phase 2 code and documentation returned
**no blocking defect**. It raised five non-blocking correctness concerns and a
set of documentation accuracy points. All confirmed items were fixed and the
affected suites were re-run; nothing was staged or committed.

| Finding | Classification | Resolution |
|---|---|---|
| `GET /transactions/categories` could return freshly flushed but uncommitted category IDs | Genuine non-blocker | The read path now commits after ensuring system categories, so returned IDs remain valid |
| Recurring-bill duplicate guard compared the recording timestamp, not the submitted `paid_on` | Genuine non-blocker | `BillService.pay` now rejects any existing payment for the bill on the same `paid_on`; regression test added |
| Provider exception text was stored in `SyncJob.error_message` and `connection.last_error` | Genuine non-blocker | Account-retrieval failures now store a fixed client-safe message; details are logged server-side |
| Overdue subscriptions were reported as `upcoming` in `/summary` and `/upcoming` | Genuine non-blocker | Status is derived from `next_payment_date` (`overdue`/`due`/`upcoming`) for both kinds; regression test added |
| Repeat-sync test asserted a non-empty lookback window | Genuine test reliability issue | Assertion now checks idempotency (zero created, unchanged total, both accounts synced) |
| Summary test expected only transactions up to today while the summary covers the whole month | Genuine test reliability issue, found during the re-run | Expectation now queries the same calendar-month window |
| Docs implied all non-health routes require bearer; categories include user rows; pay bodies optional; system categories user-owned | Documentation inaccuracies | Corrected in `docs/api/phase-2.md`, `README.md` and this document |
| Docs “transaction dates no more than one day ahead” reported as wrong | Incorrect finding | The documentation already matched the implementation |

The review also confirmed the money string convention, signed amounts,
`NUMERIC(14,2)`, ownership `404` behaviour, `409` codes, schema constraints and
the test inventory. Its partial Phase 1 check found only additive security
hardening and no regression.

### Accepted limitations (unchanged)

Bill `skipped`/`cancelled` statuses are supported by the API but not exposed as
actions in the clients. Subscription reminders store a lead time without
delivering notifications. The upcoming view is an agenda, not a month grid.
Only the mock provider is bundled. Multi-currency totals are not converted.

## Not verified / known limitations

These items are deliberately **not** claimed as complete:

- **Live bank provider:** only the mock provider is bundled. No real institution
  or aggregator is connected, and no real credentials flow through the system.
- **Native mobile runtime:** no physical device or Android/iOS emulator build was
  run. TypeScript passes; `expo-secure-store` on a real keychain remains a manual
  verification item, and mobile has no automated test suite.
- **Phase 2 browser automation:** the 11 web and 8 mobile-web Playwright checks
  from Phase 1 were not re-run for the new Phase 2 screens. Phase 2 web coverage
  is the component test suite, lint and the production build; the live API checks
  verify the backend contract, not the rendered screens.
- **Subscription/bill reminders:** the lead time is stored and shown, but no
  email, push or in-app notification is delivered. `autopay` is a stored
  preference only; no payment executes.
- **Upcoming calendar:** both clients present a dated list/agenda. There is no
  month-grid calendar view.
- **Currency conversion:** summary and totals add stored amounts without
  conversion. Records are assumed to use the user's preferred currency.
- **Subscription status filter:** an unsupported `status` returns `409
  bad_status`, matching the implemented service and test contract. This is
  documented rather than treated as a defect.
- **Payment execution, AI analysis, forecasts, chat, approvals and
  notifications:** out of scope for Phase 2 and not implemented.
- **Rate limiting scope:** authentication limits are per backend process; a
  multi-worker deployment needs an edge or shared limiter.
- **CI/CD and production deployment:** Docker Compose is a local development
  stack. No CI pipeline or production hosting is configured.

## Documentation

- [`docs/api/phase-2.md`](../docs/api/phase-2.md) — every Phase 2 endpoint,
  filters, errors and consent/sync behaviour.
- [`docs/database/schema.md`](../docs/database/schema.md) — all Phase 1 and
  Phase 2 tables, constraints, indexes and relationships.
- [`docs/architecture/overview.md`](../docs/architecture/overview.md) — layers,
  provider abstraction, sync flow and client screens.
- [Root README](../README.md) — status, API surface, environment variables and
  verified results.
