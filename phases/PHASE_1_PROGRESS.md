# Phase 1 — Project Foundation and Authentication

**Status:** Complete for the Phase 1 scope, with the explicit limitations listed
below.

**Verified on:** 17 November 2026

Phase 1 establishes the shared foundation for AI Payment Guardian: a FastAPI and
PostgreSQL backend, secure authentication and sessions, a React web app, an Expo
mobile app, local Docker infrastructure and tests. No Phase 2 banking, financial
or AI functionality has been started.

## Requirement checklist

| Requirement | Status | Notes |
|---|---|---|
| Project structure and environments | Complete | `backend/`, `frontend/web/`, `mobile/`, `docs/`, `phases/`, `infrastructure/` |
| FastAPI application and API routing | Complete | Versioned router at `/api/v1` |
| PostgreSQL connection | Complete | SQLAlchemy 2 with psycopg; verified through Docker and tests |
| Environment configuration | Complete | Pydantic settings, `.env.example`; real `.env` gitignored |
| Database migrations | Complete | Alembic `0001_initial`; `alembic check` reports no drift |
| User registration | Complete | Email uniqueness enforced in the app and by a database constraint |
| Login and logout | Complete | Login updates `last_login_at`; logout revokes the session |
| Password hashing | Complete | Argon2id through `pwdlib`; no plain-text storage |
| Token and session management | Complete | Short-lived JWT access tokens bound to server-side sessions |
| Secure refresh handling | Complete | Rotating refresh tokens; only SHA-256 hashes stored |
| Protected endpoints | Complete | Bearer dependency validates the token and session state |
| User-level data isolation | Complete | Profile and preferences are always scoped to the authenticated user |
| Centralised exception handling | Complete | Consistent JSON error shape; internal details hidden |
| Input validation | Complete | Pydantic schemas and matching client-side validation |
| Welcome screen (web and mobile) | Complete | Explains the product without implying connected data |
| Registration screen | Complete | Name, email, password and confirmation |
| Login screen | Complete | Validation, API error display, session-safe navigation |
| Dashboard | Complete | Onboarding and future bank connection only; no fabricated finance data |
| Profile screen | Complete | Displays and updates the user's name; persists across reloads |
| Settings screen | Complete | Theme and notification preferences persisted per user |
| Loading and error states | Complete | Shared loaders, alerts and inline field errors |
| Responsive layouts | Complete | Web desktop/mobile layouts; mobile safe-area layouts |
| CORS and security headers | Complete | Configurable origins, nosniff, frame denial, referrer and permissions policies |
| Docker Compose | Complete | PostgreSQL and backend with health checks and startup migrations |
| Backend tests | Complete | 31 tests, passing on SQLite and PostgreSQL |
| Web tests | Complete | 31 tests across 6 files |
| Integration flow | Complete | Register → session restore → profile/preferences → logout → protected-route rejection |
| Documentation | Complete | Root README, this progress file and `docs/` |

## Deliberate Phase 1 extensions

Two small additions support a secure, usable foundation without starting Phase 2:

1. `POST /api/v1/auth/refresh` — refresh-token rotation is required for
   short-lived access tokens to be practical.
2. `GET/PATCH /api/v1/users/me/preferences` — the Settings screen needs a real,
   per-user persistence target; preferences were already a Phase 1 database
   requirement.

## Verification evidence

### Backend

```text
.\.venv\Scripts\python -m pytest -q
31 passed
```

Run twice: once with the default isolated SQLite database and once with
`TEST_DATABASE_URL` pointing at the PostgreSQL `guardian_test` database. Both
runs reported 31 passed.

Coverage includes registration, duplicate emails, password rules, login,
invalid credentials, refresh rotation, replay of a revoked refresh token,
logout, expired/invalid/revoked access tokens, inactive users, profile and
preference updates, health reporting, CORS behaviour and per-user isolation.

### Web

```text
npm test -- --run   → 6 test files, 31 tests passed
npm run lint        → 1 warning (Fast Refresh only-export-components)
npm run build       → succeeds
```

A Playwright smoke test against the live backend and Vite dev server passed 11
checks:

1. Welcome page renders.
2. Registration screen is reachable.
3. Dashboard shows no fabricated financial data.
4. Session restores through the httpOnly refresh cookie after reload.
5. Profile update persists.
6. Updated profile survives reload.
7. Theme preference applies immediately.
8. Preferences persist after reload.
9. Logout redirects to the login screen with a secure sign-out notice.
10. Protected routes reject a signed-out visitor.
11. No uncaught browser errors.

### Mobile

```text
npx tsc --noEmit                 → passes
npx expo export --platform web   → succeeds
```

A Playwright smoke test of the exported mobile web build against the live
backend passed 8 checks:

1. Welcome screen renders.
2. Registration screen is reachable.
3. Registration signs the user in.
4. Dashboard shows no fabricated financial data.
5. Profile update persists through the mobile API client.
6. Preference toggle saves through the mobile API client.
7. No uncaught browser errors.
8. Protected route rejects an unauthenticated visitor.

### Infrastructure

- Docker Compose built and started PostgreSQL and the backend successfully.
- The backend container applied migrations on startup and reported healthy.
- Live health response:
  `{"status":"ok","database":"ok","version":"1.0.0","environment":"development"}`.
- Live API checks confirmed: web refresh cookie is `HttpOnly` and `SameSite=Lax`,
  refresh tokens rotate, old tokens are rejected, logout revokes the session,
  mobile requests receive a JSON refresh token, duplicate emails and weak
  passwords are rejected, and unauthenticated requests to protected endpoints
  are rejected.

## Not verified / known limitations

These items are deliberately **not** marked complete:

- **Native mobile runtime:** no physical device or Android/iOS emulator build
  was run. `expo-secure-store` on a native target and device keychain behaviour
  remain to be verified manually.
- **Mobile automated tests:** none exist yet; verification is TypeScript, Expo
  export and the browser smoke test of that export.
- **Real bank integration:** out of scope for Phase 1.
- **Email delivery, password reset, email verification, account deletion and
  rate limiting:** not implemented in Phase 1.
- **Production deployment:** Docker Compose is a local development stack; no
  production hosting, TLS termination or CI pipeline is configured yet.
- **Web lint:** one Fast Refresh warning remains in `AuthContext.tsx`. It does
  not affect behaviour or the production build.

## Phase 2 readiness

Phase 1 provides the prerequisites Phase 2 requires:

- Authenticated user identity available to every protected route.
- Per-user ownership enforced in the data access path.
- A migration workflow ready for new banking, account and transaction tables.
- A shared API and error contract used by both clients.
- Test infrastructure that runs against SQLite for speed and PostgreSQL for
  production parity.

No Phase 2 tables, endpoints, screens or mock financial data have been added.
