# Architecture Overview

UniFlow uses a modular monolith: one FastAPI backend and one
PostgreSQL database shared by the React web app and the Expo mobile app. Phase 1
supplies authentication and sessions; Phase 2 adds consent-based financial data,
transactions, bills, subscriptions and a unified overview. Phase 3 adds
budgets, savings goals, spending preferences and a deterministic financial
intelligence engine (summaries, trends, forecasts, risks, insights and monthly
reports). No AI model is called, no notification is delivered and no payment is
executed.

## Components

```
┌─────────────────────┐        ┌─────────────────────┐
│ Web (React/Vite)    │        │ Mobile (Expo RN)    │
│ localhost:5173      │        │ Expo dev server     │
│ access token memory │        │ access token memory │
│ refresh httpOnly    │        │ refresh SecureStore │
│ cookie              │        │                     │
└─────────┬───────────┘        └─────────┬───────────┘
          │  JSON over HTTPS             │
          └──────────────┬───────────────┘
                         ▼
          ┌──────────────────────────────┐
          │ FastAPI  /api/v1             │
          │ routers → services           │
          │ → repositories → models      │
          │ provider adapter (mock)      │
          └──────────────┬───────────────┘
                         ▼
                ┌─────────────────┐
                │ PostgreSQL 17   │
                └─────────────────┘
```

## Backend layers

| Layer | Location | Responsibility |
|---|---|---|
| Entry point | `backend/app/main.py` | App factory, CORS, security headers, exception handlers, lifespan |
| Configuration | `backend/app/core/config.py` | Environment settings, production secret validation, `BANK_PROVIDER`, `BANK_SYNC_LOOKBACK_DAYS` |
| Database | `backend/app/core/database.py` | Engine, session factory, base model and timestamp mixin |
| Security primitives | `backend/app/core/security.py` | Argon2id hashing, JWT creation/validation, refresh tokens, UTC helpers |
| Rate limiting | `backend/app/core/rate_limit.py` | In-process per-IP sliding-window limiter for authentication endpoints |
| Errors | `backend/app/core/exceptions.py` | Typed application errors and safe JSON error responses |
| Routers | `backend/app/api/`, `backend/app/modules/` | HTTP endpoints and request dependencies |
| Schemas | `backend/app/schemas/` | Pydantic validation and response models |
| Services | `backend/app/services/` | Business rules and transactional behaviour |
| Repositories | `backend/app/repositories/` | Ownership-scoped SQLAlchemy queries |
| Provider adapters | `backend/app/providers/bank/` | Provider-neutral banking interface and mock implementation |
| Models | `backend/app/models/` | `User`, `UserPreferences`, `AuthSession`, the Phase 2 financial models and the Phase 3 budget/intelligence models |
| Migrations | `backend/migrations/` | Alembic revisions `0001_initial`, `0002_phase2_financial` and `0003_phase3_intelligence` |

Routers stay thin: they validate input, call a service and shape the response.
Services own business rules, deduplication, consent checks and schedule
advances. Repositories keep queries in one place; every user-facing lookup is
scoped by the authenticated user's ID, and connection-internal lookups run only
after the owning connection has been verified.

## Phase 2 modules

| Module | Prefix | Responsibility |
|---|---|---|
| Banking | `/banking` | Providers, connections, consents, sync jobs |
| Accounts | `/accounts` | Provider-synced financial accounts |
| Transactions | `/transactions` | Filtering, manual entry, categories, edits |
| Bills | `/bills` | Bill CRUD, payments, recurrence, history |
| Subscriptions | `/subscriptions` | Subscription CRUD, payments, status, history |
| Overview | `/summary`, `/upcoming`, `/recurring-payments` | Dashboard summary and rule-based suggestions |

## Phase 3 modules

| Module | Prefix | Responsibility |
|---|---|---|
| Budgets | `/budgets` | Period budgets, overlap checks, spending vs limit |
| Savings goals | `/savings-goals` | Targets, progress, per-currency summary |
| Spending preferences | `/spending-preferences` | Awareness, threshold and reminder timing |
| Financial intelligence | `/intelligence` | Monthly summary, trends, forecast, reports, risks, insights, pre-transaction awareness |

Phase 3 services:

- `BudgetService` — CRUD, active-period overlap rejection and
  `spending_summary` (spent, remaining, overspending, percent used).
- `SavingsGoalService` — CRUD and a summary that reports one currency at a time
  with a `currency_breakdown`.
- `SpendingPreferenceService` — one row per user, created on first read.
- `IntelligenceService` — monthly summary, weekly trends, cash-flow forecast,
  monthly reports, risk detection, insight persistence, pre-transaction
  awareness and post-transaction evaluation.
- `FinancialInsightService` — list, dismiss, duplicate suppression and create.
- `SummaryService` / `TransactionRepository.sum_between` — totals scoped to one
  currency with a per-currency breakdown.

All calculations are deterministic Python (`Decimal`) over stored records. No
service calls an external model, an exchange-rate API or a notification
provider.

Services and repositories:

- `BankingService` / `BankingRepository` — connect, revoke, sync, jobs.
- `AccountService` — active/inactive account lookup.
- `TransactionService`, `CategoryRepository`, `TransactionRepository` —
  filtering, manual entry, categorisation and deduplication.
- `BillService`, `SubscriptionService`, `PaymentRepository` — obligations,
  payment history and schedule advancement.
- `SummaryService`, `RecurringPaymentService` — overview and suggestions.
- `categorization.py`, `recurrence.py` — deterministic, explainable rules.

## Provider abstraction

`backend/app/providers/bank/base.py` defines `BankProvider` with:

- `list_institutions()`
- `authorize(institution_id, user_reference)` → opaque reference, scopes and
  expiry
- `revoke(external_reference)`
- `list_accounts(external_reference)`
- `list_transactions(external_reference, account_external_id, since)`

Providers return provider-neutral dataclasses, which `BankingService` validates
before storage. The financial modules never import a concrete provider, so a
live adapter can be registered without changing accounts, transactions, bills or
subscriptions. Only the mock provider is bundled (`slug="mock"`, four demo
institutions, `is_mock=True`); every connection, account and summary derived
from it is labelled as mock.

No provider may accept or return banking passwords, PINs, OTPs or card security
codes. The connection stores only an opaque provider reference and consent
metadata.

## Consent and synchronisation flow

1. `POST /banking/connections` resolves the provider (default `BANK_PROVIDER`),
   calls `authorize`, stores a `BankConnection` and a `BankConsent` with scopes
   and `expires_at`, then runs a first sync.
2. Sync takes a row lock on the connection, rejects revoked or expired consent,
   creates a `SyncJob`, retrieves accounts, validates them, and upserts accounts
   by `(connection_id, external_id)`.
3. Transactions are retrieved per account, validated, categorised, and inserted
   with a per-account SHA-256 dedupe key. Existing keys are counted as skipped.
4. The job ends as `succeeded`, `partial` or `failed`; `connection.last_synced_at`
   and a safe `last_error` are updated.
5. `DELETE /banking/connections/{id}` marks the consent and connection revoked,
   deactivates accounts and best-effort revokes at the provider. A later sync
   returns `409 connection_revoked`.
6. If consent expires, sync marks both consent and connection expired and
   returns `409 consent_expired`.

The first sync looks back `BANK_SYNC_LOOKBACK_DAYS` (default 120). Later syncs
start three days before the previous sync to absorb late-posted records; the
dedupe key prevents duplicates.

## Request flow: manual transaction with awareness

1. Before submitting, the client posts the amount to
   `/intelligence/proactive-awareness`. The server returns `null` when
   awareness is disabled or the amount is below the user's threshold;
   otherwise it returns the projected effect on the available balance and the
   next dues.
2. The client submits `POST /transactions`.
3. `TransactionService.create_with_alerts` validates the account and currency,
   resolves the category, computes the dedupe key and stores the transaction.
4. It then calls `IntelligenceService.evaluate_transaction`, which applies the
   user's preferences and persists matching `significant_spending`,
   `entertainment_spending`, `unusual_spending` and `duplicate_transaction`
   insights.
5. The response carries the transaction plus its `alerts`. A blocked duplicate
   returns `409 duplicate_transaction` after persisting the duplicate insight.
6. Insights appear on the Intelligence screen. Nothing is pushed, emailed or
   texted.

## Request flow: forecast and report

1. The client requests `/intelligence/forecast?days=30` or
   `/intelligence/reports?year=…&month=…`.
2. `IntelligenceService` resolves the reporting currency, sums active accounts
   in that currency and filters obligations to it. Other currencies are
   reported separately and never converted.
3. The forecast subtracts overdue and due-today obligations from the opening
   balance, estimates recurring income from 90 days of credits and walks the
   window day by day.
4. Reports reuse the monthly summary, the month's transactions, active
   overlapping budgets and the savings summary, then add month-over-month
   changes, top payees and explicit notes.
5. Both responses are computed on demand; no snapshot or file is stored.

## Web app

`frontend/web/src` is organised by feature:

- `app/` — router composition and route guards.
- `components/` — layout, UI primitives and finance badges.
- `features/auth/` — auth context, validation and session lifecycle.
- `pages/` — Welcome, Register, Login, Dashboard, Accounts, Transactions, Bills,
  Subscriptions, Upcoming, Budgets, Savings Goals, Spending Preferences,
  Intelligence, Reports, Profile, Settings, Not Found.
- `services/` — Axios client, `financeApi`, auth API wrappers and shared types.
- `hooks/`, `utils/` — document title, theme, formatting and error extraction.

Authenticated routes:

| Route | Screen |
|---|---|
| `/dashboard` | Summary cards, due soon, recent activity, month totals |
| `/accounts` | Provider/institution selection, connection, sync, revoke, balances |
| `/transactions` | Filters, search, pagination, manual entry, detail/edit/delete |
| `/bills` | Create/edit/delete, state filters, pay, payment history |
| `/subscriptions` | Create/edit/delete, status filters, pay, payment history |
| `/upcoming` | Bills and subscriptions by date, recurring suggestions |
| `/budgets` | Budget planner with spending progress |
| `/savings-goals` | Savings targets and per-currency summary |
| `/spending-preferences` | Awareness, threshold and reminder settings |
| `/intelligence` | Summary, trends, forecast, risks and insights |
| `/reports` | On-demand monthly financial report |
| `/profile`, `/settings` | Phase 1 account and preference management |

The access token lives in a module variable inside `services/apiClient.ts`. A
single-flight refresh routine attaches a new token after a 401 and retries the
original request once. A `SESSION_EXPIRED_EVENT` clears the auth context if
refresh fails.

Route protection is declarative: `ProtectedRoute` waits for bootstrap, then
redirects unauthenticated visitors to `/login` with the intended path, and
`PublicOnlyRoute` sends authenticated visitors to `/dashboard`.

## Mobile app

`mobile/app` uses Expo Router file-based routes:

- `index.tsx` — Welcome.
- `register.tsx`, `login.tsx` — authentication.
- `(app)/_layout.tsx` — tab navigator and auth guard.
- `(app)/dashboard.tsx` — summary, due soon, recent activity.
- `(app)/accounts.tsx` — connect, sync, revoke and balances.
- `(app)/transactions.tsx` — filters, manual entry, edit and delete.
- `(app)/payments.tsx` — bills, subscriptions, upcoming and suggestions.
- `(app)/budgets.tsx`, `(app)/savings-goals.tsx` — budget and savings screens.
- `(app)/intelligence.tsx` — summary, forecast and insights.
- `(app)/spending-preferences.tsx` — awareness settings.
- `(app)/reports.tsx` — monthly report, registered as a hidden tab and linked
  from the UniFlow screen.
- `(app)/profile.tsx`, `(app)/settings.tsx` — account and preferences.
- `+not-found.tsx` — fallback.

Shared code lives in `mobile/src`, mirroring the web structure. The Axios client
adds `X-Client-Platform: mobile`, keeps the access token in memory, stores the
rotating refresh token through `expo-secure-store`, and retries one 401 after a
successful refresh. On web, SecureStore is unavailable, so the preview keeps the
refresh token in memory only.

## Request flow: sign in

1. Client posts email and password to `/api/v1/auth/login`.
2. The backend applies the per-IP login limit, normalises the email, verifies
   the Argon2id hash and rejects inactive accounts.
3. A session row is created with a SHA-256 hash of a new refresh token and an
   expiry timestamp.
4. An access JWT is signed with `sub` (user ID), `sid` (session ID), `type`,
   `iat`, `exp`, `jti`.
5. The response returns the access token and user. Browsers also receive the
   refresh token as an `HttpOnly` cookie; mobile clients receive it in JSON.
6. The client stores the access token in memory only.

## Request flow: protected request

1. Client sends `Authorization: Bearer <access token>`.
2. `get_current_user` verifies the signature, expiry and token type.
3. It loads the referenced session and rejects missing, revoked or expired
   sessions, mismatched users and inactive accounts.
4. The route receives the `User`; services and repositories scope every query to
   that user ID, so another user's records resolve as `404`.

## Request flow: token refresh

1. On a 401 from a non-auth endpoint, the client calls `/auth/refresh` once.
2. The backend hashes the presented refresh token and looks up the session.
3. A revoked token triggers revocation of every session for that user.
4. A valid token is revoked and replaced atomically; a new access token is
   issued alongside the new refresh token.
5. The client retries the original request once. A second failure clears local
   state and sends the user to sign-in.

## Request flow: connect and sync

1. Web/mobile loads `/banking/providers`, `/banking/connections` and `/accounts`.
2. The user selects a provider and institution; the client posts
   `/banking/connections`.
3. The backend authorises consent, stores the connection, runs the first sync
   and returns the connection plus its `SyncJob`.
4. Subsequent syncs post to `/banking/connections/{id}/sync`; the UI reports
   accounts synced, transactions created and transactions skipped.
5. Revoking consent calls `DELETE /banking/connections/{id}`; deactivated
   accounts disappear from the default account list and sync is refused.

## Security and ownership

- Every Phase 2 table is user-owned. User-facing repository lookups filter by
  `user_id`; connection-internal lookups run only after the owning connection
  has been verified. Cross-user access returns `404`.
- Manual transaction deduplication and provider deduplication are enforced by a
  unique `(account_id, dedupe_key)` constraint.
- Manual transactions cannot be created on inactive accounts, and their
  currency must match the account.
- Provider-synced transactions cannot be deleted through the API.
- Bills, subscriptions and payments are owner-scoped; deleting an obligation
  cascades only that owner's payment history.
- Mock data is flagged in responses and in both clients.

## Deliberate boundaries

- No payment execution, money movement or autonomous action exists.
- No live bank provider is configured; the mock is the only registered adapter.
- No AI/LLM analysis, chat, approvals or notification delivery exists yet.
  Phase 3 insight is deterministic and advisory.
- No currency conversion is performed anywhere; multi-currency data is always
  reported per currency.
- Docker Compose runs PostgreSQL and the backend only; client dev servers run on
  the host for fast reloads.
- Web and mobile share the same API contract and error shape, but keep
  platform-appropriate credential storage.

## Extension points for Phase 4

- Build the AI assistant on the existing `IntelligenceService`,
  `SummaryService` and budget services as a controlled, read-only tool layer.
- Add a live `BankProvider` implementation and register its slug in
  `backend/app/providers/bank/registry.py`.
- Add new tables through Alembic revisions; never edit applied migrations.
- Reuse `CurrentUser` and repository-level `user_id` scoping for ownership.
- Build new screens behind the existing auth context and API wrappers.
