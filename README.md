# UniFlow

UniFlow is an approval-based personal finance assistant. The final
product will help users understand authorised bank data, upcoming payments and
forecasts. This repository currently contains **Phase 1: Project Foundation and
Authentication**, **Phase 2: Bank Integration and Financial Data Management**
and **Phase 3: Financial Intelligence and Prediction Engine**.

Phase 1 delivers a secure account foundation shared by a React web app, an Expo
(React Native) mobile app and a FastAPI/PostgreSQL backend. Phase 2 adds
consent-based bank connections through a provider adapter (the bundled provider
is clearly labelled mock data), synchronised accounts and transactions, manual
transaction entry with duplicate detection, bills, subscriptions, payment
history, upcoming payments and a dashboard summary.

Phase 3 adds budget planning, savings goals, spending preferences, monthly
summaries, spending trends, cash-flow forecasts, risk detection, persisted
insights and monthly financial reports. Every figure is computed
deterministically from stored records, in one currency at a time, with no
exchange-rate conversion.

Phases 2–3 intentionally contain **no AI behaviour, notification delivery,
payment execution or autonomous actions**. Bills, subscriptions and payments are
records that the user controls; nothing is paid automatically and no alert is
pushed, emailed or texted.

## Status

Phase 1 is complete and formally closed. Phase 2 is implemented, documented and
verified against SQLite, PostgreSQL, the live Docker backend, the web app and
mobile TypeScript.

Phase 3 is implemented and verified on 23 November 2026. Revision
`0003_phase3_intelligence` **is applied** to the development database (verified
24 November 2026, `alembic current` and `alembic check` both clean). It was
applied automatically: the Docker backend runs `alembic upgrade head` before
starting Uvicorn, so migration approval is not separated from application
startup. Phase 3 is still **not formally closed**: the three PostgreSQL-only
locking tests have not been run against `guardian_test`. See
[`docs/database/schema.md`](docs/database/schema.md#migrations) for the current
revision state and the migration rules.

See [`phases/PHASE_3_PROGRESS.md`](phases/PHASE_3_PROGRESS.md) for the Phase 3
requirement checklist and exact results, and
[`phases/PHASE_2_PROGRESS.md`](phases/PHASE_2_PROGRESS.md) for Phase 2. Both
documents list what has **not** been tested (real bank providers, native device
builds, automated mobile tests, notification delivery). Phase 1 evidence
remains in [`phases/PHASE_1_PROGRESS.md`](phases/PHASE_1_PROGRESS.md).

## Stack

| Layer | Technology |
|---|---|
| Web | React 19, TypeScript, Vite, React Router, Axios |
| Mobile | React Native, Expo SDK 58, Expo Router, TypeScript, Axios |
| Backend | Python, FastAPI, Pydantic, SQLAlchemy 2, Alembic |
| Database | PostgreSQL 17 |
| Security | Argon2id passwords (pwdlib), short-lived JWT access tokens, rotating hashed refresh tokens, server-side sessions |
| Infrastructure | Docker Compose (PostgreSQL + backend) |

## Repository layout

```
backend/            FastAPI app, SQLAlchemy models, Alembic migrations, tests
frontend/web/       React + Vite web application
mobile/             Expo Router mobile application
docs/               Architecture, API, database and security notes
phases/             Phase progress documents
infrastructure/     PostgreSQL init scripts used by Docker Compose
docker-compose.yml  PostgreSQL + backend development stack
```

## Prerequisites

- Python 3.12+ and a virtual environment for the backend
- Node.js 20+ and npm
- Docker Desktop (recommended for PostgreSQL)
- Expo Go or an Android/iOS emulator for native mobile testing

## Quick start

### 1. Configure the environment

```powershell
Copy-Item .env.example .env
```

Edit `.env` and replace every placeholder, in particular:

- `POSTGRES_PASSWORD`
- `JWT_SECRET_KEY` (generate with
  `python -c "import secrets; print(secrets.token_urlsafe(48))"`)
- `DATABASE_URL`, if you are not using the Docker Compose host names
- `TEST_DATABASE_URL` (must end in `_test`)

`.env` is gitignored. Never commit real secrets.

### 2. Start PostgreSQL and the backend with Docker

```powershell
docker compose up -d --build
```

This starts PostgreSQL and the backend, waits for the database, applies Alembic
migrations and exposes the API at <http://localhost:8000/api/v1>.

Check it:

```powershell
Invoke-RestMethod http://localhost:8000/api/v1/health
```

### 3. Run the web app

```powershell
cd frontend/web
npm install
npm run dev
```

Open <http://localhost:5173>. Vite proxies `/api/v1` to the backend, so the
refresh cookie is first-party in development.

### 4. Run the mobile app

```powershell
cd mobile
npm install
npx expo start
```

- Emulator/simulator: the default `http://localhost:8000/api/v1` usually works.
- Physical device: set `EXPO_PUBLIC_API_URL` to your computer's LAN address,
  for example `http://192.168.1.20:8000/api/v1`, and ensure both devices are on
  the same network.

The backend must allow the app's origin. Browser origins are controlled by
`CORS_ORIGINS`; native apps do not send a browser origin.

## API

Base path: `/api/v1`

Phase 1 (identity and sessions):

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/health` | Public | Service and database health |
| `POST` | `/auth/register` | Public | Create an account and start a session |
| `POST` | `/auth/login` | Public | Sign in |
| `POST` | `/auth/refresh` | Refresh token | Rotate the refresh token, issue a new access token |
| `POST` | `/auth/logout` | Access and/or refresh token | Revoke the current session |
| `GET` | `/auth/me` | Bearer | Current authenticated user |
| `GET` | `/users/me` | Bearer | Current user's profile |
| `PATCH` | `/users/me` | Bearer | Update the current user's profile |
| `GET` | `/users/me/preferences` | Bearer | Current user's preferences |
| `PATCH` | `/users/me/preferences` | Bearer | Update preferences |

Phase 2 (financial data). Every Phase 2 route requires a bearer token except the
provider catalogue:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/banking/providers` | Public list of providers and institutions |
| `POST` | `/banking/connections` | Create a consent-based connection and run an initial sync |
| `GET` | `/banking/connections` | List the user's connections with accounts and consents |
| `GET` | `/banking/connections/{id}` | Get one connection |
| `DELETE` | `/banking/connections/{id}` | Revoke consent and deactivate accounts |
| `POST` | `/banking/connections/{id}/sync` | Synchronise accounts and transactions |
| `GET` | `/banking/sync-jobs` | List recent sync jobs |
| `GET` | `/banking/sync-jobs/{id}` | Get one sync job |
| `GET` | `/accounts` | List financial accounts (`active_only` default `true`) |
| `GET` | `/accounts/{id}` | Get one account |
| `GET` | `/transactions/categories` | List transaction categories |
| `GET` | `/transactions` | Filtered, paginated transaction history |
| `POST` | `/transactions` | Record a manual transaction |
| `GET` | `/transactions/{id}` | Get one transaction |
| `PATCH` | `/transactions/{id}` | Recategorise or annotate a transaction |
| `DELETE` | `/transactions/{id}` | Delete a manual transaction |
| `GET` | `/bills` | List bills by state |
| `POST` | `/bills` | Create a bill |
| `GET` | `/bills/{id}` | Get one bill |
| `PATCH` | `/bills/{id}` | Update a bill |
| `DELETE` | `/bills/{id}` | Delete a bill and its payment history |
| `POST` | `/bills/{id}/pay` | Record a payment and advance a recurring schedule |
| `GET` | `/bills/{id}/payments` | Bill payment history |
| `GET` | `/subscriptions` | List subscriptions |
| `POST` | `/subscriptions` | Create a subscription |
| `GET` | `/subscriptions/{id}` | Get one subscription |
| `PATCH` | `/subscriptions/{id}` | Update, pause or resume a subscription |
| `DELETE` | `/subscriptions/{id}` | Delete a subscription and its payment history |
| `POST` | `/subscriptions/{id}/pay` | Record a payment and advance the billing date |
| `GET` | `/subscriptions/{id}/payments` | Subscription payment history |
| `GET` | `/summary` | Dashboard summary |
| `GET` | `/upcoming` | Bills and subscriptions due within a window |
| `GET` | `/recurring-payments` | Rule-based recurring-payment suggestions |

Phase 3 (budgeting, savings and financial intelligence). Every route requires a
bearer token:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/budgets` | List budgets, optionally with spending progress |
| `POST` | `/budgets` | Create a budget |
| `GET` | `/budgets/{id}` | Get one budget |
| `PATCH` | `/budgets/{id}` | Update a budget |
| `DELETE` | `/budgets/{id}` | Delete a budget |
| `GET` | `/budgets/{id}/spending` | Budget spending summary |
| `GET` | `/savings-goals` | List savings goals |
| `POST` | `/savings-goals` | Create a savings goal |
| `GET` | `/savings-goals/summary` | Per-currency savings totals |
| `GET` | `/savings-goals/{id}` | Get one savings goal |
| `PATCH` | `/savings-goals/{id}` | Update a savings goal |
| `DELETE` | `/savings-goals/{id}` | Delete a savings goal |
| `GET` | `/spending-preferences` | Awareness and reminder preferences |
| `PATCH` | `/spending-preferences` | Update those preferences |
| `GET` | `/intelligence/summary` | Monthly income, expenses and categories |
| `GET` | `/intelligence/trends` | Weekly spending and trend direction |
| `GET` | `/intelligence/forecast` | Cash-flow forecast for a window |
| `GET` | `/intelligence/reports` | Monthly financial report |
| `GET` | `/intelligence/risks` | Detected risks (not persisted) |
| `POST` | `/intelligence/insights` | Generate and persist risk insights |
| `GET` | `/intelligence/insights` | List persisted insights |
| `PATCH` | `/intelligence/insights/{id}/dismiss` | Dismiss an insight |
| `POST` | `/intelligence/proactive-awareness` | Pre-transaction spending check |

`POST /transactions` now also returns persisted spending-awareness `alerts`.

Interactive OpenAPI documentation is available at <http://localhost:8000/docs>
in non-production environments. Full request/response details are documented in
[`docs/api/phase-1.md`](docs/api/phase-1.md),
[`docs/api/phase-2.md`](docs/api/phase-2.md) and
[`docs/api/phase-3.md`](docs/api/phase-3.md).

Authentication endpoints return `429` with a `Retry-After` header when the
per-client rate limit is exceeded. Phase 2 routes do not execute payments or
call an AI service.

## Authentication design

- Passwords are hashed with Argon2id. Plain-text passwords are never stored or
  logged, and validation errors never echo submitted values.
- Access tokens are short-lived JWTs (15 minutes by default) bound to a
  server-side session ID. Revoking the session invalidates its access tokens
  immediately, without waiting for expiry.
- Refresh tokens are random 48-byte values. Only their SHA-256 hash is stored.
  Every use rotates the token and revokes the previous session row.
- Replaying a revoked refresh token revokes all sessions for that user.
- **Web:** the refresh token lives in an `HttpOnly`, `SameSite=Lax` cookie scoped
  to `/api/v1/auth`; the access token is held in memory only. Nothing sensitive
  is written to `localStorage`.
- **Mobile:** the refresh token is returned in the JSON response when the
  request supplies it in the body (registration/login uses the
  `X-Client-Platform: mobile` header), and is stored with
  `expo-secure-store` (device keychain/keystore). A cookie-authenticated
  refresh never returns it in the body.
- Protected endpoints resolve the user from the token and reject revoked,
  expired, mismatched or disabled accounts. Account-status changes revoke all
  sessions atomically through the status service, and an ORM guard applies the
  same rule to any other ORM write of `is_active`. Refresh rotation is
  serialised with status changes; raw SQL writes bypass the guard.
- Login, registration and refresh are rate-limited per client address and
  action. Exceeding the limit returns `429` with `Retry-After`. The limiter is
  in-process, so deployments with multiple workers also need edge or shared
  rate limiting.

More detail: [`docs/security/authentication.md`](docs/security/authentication.md).

## Environment variables

| Variable | Purpose |
|---|---|
| `ENVIRONMENT` | `development` or `production`; production disables API docs and enables HSTS |
| `DEBUG` | Backend debug flag |
| `APP_VERSION` | Version returned by `/health` |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Docker PostgreSQL credentials |
| `DATABASE_URL` | SQLAlchemy connection string (`postgresql+psycopg://...`) |
| `JWT_SECRET_KEY` | Signing key for access tokens |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access token lifetime (default 15) |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh session lifetime (default 7) |
| `REFRESH_COOKIE_SECURE` | Set `true` behind HTTPS |
| `REFRESH_COOKIE_SAMESITE` | `lax`, `strict` or `none` |
| `AUTH_RATE_LIMIT_ENABLED` | Enable per-IP authentication rate limiting (default `true`) |
| `AUTH_RATE_LIMIT_ATTEMPTS` | Allowed authentication requests per window (default `10`) |
| `AUTH_RATE_LIMIT_WINDOW_SECONDS` | Rate-limit window in seconds (default `300`) |
| `CORS_ORIGINS` | Comma-separated browser origins allowed to call the API |
| `BANK_PROVIDER` | Default financial-data provider slug (default `mock`) |
| `BANK_SYNC_LOOKBACK_DAYS` | First-sync transaction lookback in days (default `120`, 1–3650) |
| `VITE_API_BASE_URL` | Optional web API base URL (defaults to the Vite proxy) |
| `EXPO_PUBLIC_API_URL` | Mobile API base URL |
| `TEST_DATABASE_URL` | PostgreSQL test database; must end in `_test` |

## Tests and checks

Backend (isolated SQLite by default):

```powershell
cd backend
.\.venv\Scripts\python -m pytest -q
```

Backend against PostgreSQL:

```powershell
cd backend
$env:TEST_DATABASE_URL = "postgresql+psycopg://guardian:<password>@localhost:5432/guardian_test"
.\.venv\Scripts\python -m pytest -q
```

Web:

```powershell
cd frontend/web
npm test -- --run
npm run lint
npm run build
```

Mobile:

```powershell
cd mobile
npx tsc --noEmit
npx expo export --platform web
```

Last verified results (23 November 2026, Phase 3 completion):

| Check | Result |
|---|---|
| Backend tests on SQLite | 149 passed, 3 PostgreSQL-only tests skipped |
| Backend tests on PostgreSQL | Not run; `guardian_test` is empty and a run would reset it |
| Alembic `heads` / `current` | `0003_phase3_intelligence (head)`; database at `0003_phase3_intelligence` |
| Alembic `check` | `No new upgrade operations detected` (24 November 2026, after aligning `Forecast` with revision 0003) |
| Alembic offline DDL | `0002:0003 --sql` generated PostgreSQL DDL, no writes |
| Web tests | 55 passed across 12 files |
| Web TypeScript (`tsc -b`) | Passes |
| Web lint | 0 errors, 1 non-blocking Fast Refresh warning |
| Web production build | Succeeds |
| Mobile TypeScript (`tsc --noEmit`) | Passes |

Phase 2's closure audit (21 November 2026) recorded 116 backend tests passed on
PostgreSQL, 24 live API checks passed, and a healthy Docker stack; those results
remain the Phase 2 evidence. Phase 3 added 12 backend tests and 6 web tests. The
Phase 3 screens are covered by component tests, type-check, lint and the
production build; **no browser automation run exercised them**.

Phase 1 browser smoke tests (11 web checks and 8 mobile-web export checks)
passed in the previous phase.

## Documentation

- [Phase 1 progress and verification](phases/PHASE_1_PROGRESS.md)
- [Phase 2 progress and verification](phases/PHASE_2_PROGRESS.md)
- [Phase 3 progress and verification](phases/PHASE_3_PROGRESS.md)
- [Architecture overview](docs/architecture/overview.md)
- [Database schema](docs/database/schema.md)
- [Phase 1 API reference](docs/api/phase-1.md)
- [Phase 2 API reference](docs/api/phase-2.md)
- [Phase 3 API reference](docs/api/phase-3.md)
- [Authentication and security](docs/security/authentication.md)
- [Local development](docs/deployment/local-development.md)
- [Master blueprint](PROJECT_BLUEPRINT.md)

## Scope and known limitations

- Phases 1–3 are implemented. AI chat, approvals, action execution and
  notification delivery are later phases.
- Only the mock financial-data provider is bundled. A live bank-data provider
  must implement the `BankProvider` interface; no real institution is connected.
- Bills, subscriptions and payments are records and reminders. No payment is
  executed, and `autopay` is a stored preference only.
- No currency conversion exists. Dashboard, savings, forecast, trend and report
  totals cover the user's preferred currency; other currencies are listed in a
  `currency_breakdown` and are never added together.
- Forecasts are computed on demand, not stored. Expected income is a
  deterministic recurring-income heuristic and expected expenses cover known
  obligations only, not discretionary spending.
- Insights are advisory in-app records. No email, push or SMS is delivered, and
  `enable_post_payment_reminders` is stored but has no scheduler yet.
- Phase 3 requires migration `0003_phase3_intelligence`; until it is applied,
  the Phase 3 endpoints cannot serve the development database.
- Native mobile builds have not been run on a physical device or emulator in
  this environment. TypeScript passes; `expo-secure-store` behaviour on a real
  device still needs manual verification.
- Mobile has no automated unit test suite yet. Phase 2 mobile screens are
  verified by TypeScript only.
- Password reset, email verification, account deletion and MFA are not
  implemented.
- Authentication rate limiting is per backend process. A multi-worker or
  multi-replica deployment must add an edge or shared limiter. Counters reset
  on restart, and the refresh allowance is shared by all clients behind one
  address.
- Docker Compose includes PostgreSQL and the backend only. The web and mobile
  apps run locally during development.
