# Architecture Overview

AI Payment Guardian uses a modular monolith: one FastAPI backend and one
PostgreSQL database shared by the React web app and the Expo mobile app. Phase 1
implements only the account and session foundation.

## Components

```
┌──────────────────┐        ┌──────────────────┐
│  Web (React/Vite)│        │ Mobile (Expo RN) │
│  localhost:5173  │        │  Expo dev server │
└────────┬─────────┘        └────────┬─────────┘
         │  JSON over HTTPS          │
         │  access token in memory   │  access token in memory
         │  refresh in httpOnly      │  refresh in SecureStore
         │  cookie                   │
         └────────────┬──────────────┘
                      ▼
          ┌───────────────────────┐
          │  FastAPI  /api/v1     │
          │  routers → services   │
          │  → repositories       │
          └───────────┬───────────┘
                      ▼
              ┌───────────────┐
              │  PostgreSQL   │
              └───────────────┘
```

## Backend layers

| Layer | Location | Responsibility |
|---|---|---|
| Entry point | `backend/app/main.py` | App factory, CORS, security headers, exception handlers, lifespan |
| Configuration | `backend/app/core/config.py` | Environment settings and production secret validation |
| Database | `backend/app/core/database.py` | Engine, session factory, base model and timestamp mixin |
| Security primitives | `backend/app/core/security.py` | Argon2id hashing, JWT creation/validation, refresh token generation |
| Errors | `backend/app/core/exceptions.py` | Typed application errors and safe JSON error responses |
| Routers | `backend/app/api/`, `backend/app/modules/` | HTTP endpoints and request dependencies |
| Schemas | `backend/app/schemas/` | Pydantic validation and response models |
| Services | `backend/app/services/` | Business rules: registration, login, rotation, logout, profile updates |
| Repositories | `backend/app/repositories/` | SQLAlchemy queries |
| Models | `backend/app/models/` | `User`, `UserPreferences`, `AuthSession` |
| Migrations | `backend/migrations/` | Alembic schema history |

Routers stay thin: they validate input, call a service and shape the response.
Services own transactional behaviour and security decisions. Repositories keep
queries in one place so Phase 2 modules can follow the same pattern.

## Web app

`frontend/web/src` is organised by feature rather than file type where it
matters:

- `app/` — router composition and route guards.
- `components/` — shared layout and UI primitives.
- `features/auth/` — auth context, validation and session lifecycle.
- `pages/` — Welcome, Register, Login, Dashboard, Profile, Settings, Not Found.
- `services/` — Axios client, API wrappers and shared types.
- `hooks/`, `utils/` — document title, theme, formatting and error extraction.

The access token lives in a module variable inside `services/apiClient.ts`. A
single-flight refresh routine attaches a new token after a 401 and retries the
original request once. A `SESSION_EXPIRED_EVENT` clears the auth context if
refresh fails.

Route protection is declarative:

- `ProtectedRoute` waits for bootstrap, then redirects unauthenticated visitors
  to `/login` with the intended path.
- `PublicOnlyRoute` sends authenticated visitors to `/dashboard`.
- After an explicit sign-out, `AuthContext.signedOutNotice` drives the
  confirmation message on the login screen. This is state, not navigation state,
  because the route guard's redirect would otherwise overwrite it.

## Mobile app

`mobile/app` uses Expo Router file-based routes:

- `index.tsx` — Welcome.
- `register.tsx`, `login.tsx` — authentication.
- `(app)/_layout.tsx` — tab navigator and auth guard.
- `(app)/dashboard.tsx`, `profile.tsx`, `settings.tsx` — signed-in screens.
- `+not-found.tsx` — fallback.

Shared code lives in `mobile/src`, mirroring the web structure. The Axios client
adds `X-Client-Platform: mobile`, keeps the access token in memory, stores the
rotating refresh token through `expo-secure-store`, and retries one 401 after a
successful refresh. On web, SecureStore is unavailable, so the preview keeps the
refresh token in memory only.

## Request flow: sign in

1. Client posts email and password to `/api/v1/auth/login`.
2. The backend normalises the email, verifies the Argon2id hash and rejects
   inactive accounts.
3. A session row is created with a SHA-256 hash of a new refresh token and an
   expiry timestamp.
4. An access JWT is signed with `sub` (user ID), `sid` (session ID), `type`,
   `iat`, `exp` and `jti`.
5. The response returns the access token and user. Browsers also receive the
   refresh token as an `HttpOnly` cookie; mobile clients receive it in JSON.
6. The client stores the access token in memory only.

## Request flow: protected request

1. Client sends `Authorization: Bearer <access token>`.
2. `get_current_user` verifies the signature, expiry and token type.
3. It loads the referenced session and rejects missing, revoked or expired
   sessions, mismatched users and inactive accounts.
4. The route receives the `User` and scopes all data access to that user.

## Request flow: token refresh

1. On a 401 from a non-auth endpoint, the client calls `/auth/refresh` once.
2. The backend hashes the presented refresh token and looks up the session.
3. A revoked token triggers revocation of every session for that user.
4. A valid token is revoked and replaced atomically; a new access token is
   issued alongside the new refresh token.
5. The client retries the original request once. A second failure clears local
   state and sends the user to sign-in.

## Deliberate boundaries

- No financial models, mock transactions or AI calls exist in Phase 1.
- The dashboard copy explains onboarding and future bank connection rather than
  showing placeholder balances.
- Docker Compose runs PostgreSQL and the backend only; client dev servers run on
  the host for fast reloads.
- Web and mobile share the same API contract and error shape, but keep
  platform-appropriate credential storage.

## Extension points for later phases

- Add modules under `backend/app/modules/` (banking, accounts, transactions) and
  register them in `backend/app/api/v1/router.py`.
- Add tables through Alembic revisions; never edit applied migrations.
- Reuse `CurrentUser` for ownership-scoped queries.
- Add new client features behind the existing auth context and API wrappers.
