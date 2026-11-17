# AI Payment Guardian

AI Payment Guardian is an approval-based personal finance assistant. The final
product will help users understand authorised bank data, upcoming payments and
forecasts. This repository currently contains **Phase 1: Project Foundation and
Authentication** only.

Phase 1 delivers a secure account foundation shared by a React web app, an Expo
(React Native) mobile app and a FastAPI/PostgreSQL backend. It intentionally
contains **no banking data, financial figures, forecasts or AI behaviour**. The
dashboard explains that no financial account is connected yet and that nothing
financial is stored.

## Status

Phase 1 is implemented and its automated and browser checks pass. See
[`phases/PHASE_1_PROGRESS.md`](phases/PHASE_1_PROGRESS.md) for the requirement
checklist and the exact verification results, including what has **not** been
tested (native device builds, real bank integrations, email delivery).

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

## API (Phase 1)

Base path: `/api/v1`

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

Interactive OpenAPI documentation is available at <http://localhost:8000/docs>
in non-production environments. Full request/response details are documented in
[`docs/api/phase-1.md`](docs/api/phase-1.md).

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
- **Mobile:** the refresh token is returned in the JSON response only when the
  request sends `X-Client-Platform: mobile`, and is stored with
  `expo-secure-store` (device keychain/keystore).
- Protected endpoints resolve the user from the token and reject revoked,
  expired or mismatched sessions.

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
| `CORS_ORIGINS` | Comma-separated browser origins allowed to call the API |
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

Last verified results (17 November 2026):

| Check | Result |
|---|---|
| Backend tests on SQLite | 31 passed |
| Backend tests on PostgreSQL | 31 passed |
| Web tests | 31 passed across 6 files |
| Web lint | 1 non-blocking Fast Refresh warning |
| Web production build | Succeeds |
| Mobile TypeScript (`tsc --noEmit`) | Passes |
| Mobile Expo web export | Succeeds |
| Web browser smoke test (Playwright) | 11 checks passed |
| Mobile web export smoke test (Playwright) | 8 checks passed |
| Docker health endpoint | `status=ok`, `database=ok` |

## Documentation

- [Phase 1 progress and verification](phases/PHASE_1_PROGRESS.md)
- [Architecture overview](docs/architecture/overview.md)
- [Database schema](docs/database/schema.md)
- [API reference](docs/api/phase-1.md)
- [Authentication and security](docs/security/authentication.md)
- [Local development](docs/deployment/local-development.md)
- [Master blueprint](PROJECT_BLUEPRINT.md)

## Scope and known limitations

- Phase 1 only. Bank connections, transactions, bills, forecasts, AI chat,
  approvals and notifications are later phases and are not implemented.
- The dashboard deliberately shows no balances or transactions. It explains
  onboarding and the future bank connection instead.
- Native mobile builds have not been run on a physical device or emulator in
  this environment. TypeScript, the Expo web export and a browser smoke test of
  that export pass; `expo-secure-store` behaviour on a real device still needs
  to be verified.
- Mobile has no automated unit test suite yet.
- Password reset, email verification, account deletion and rate limiting are
  not part of Phase 1.
- Docker Compose includes PostgreSQL and the backend only. The web and mobile
  apps run locally during development.
