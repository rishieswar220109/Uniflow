# Local Development

## Prerequisites

- Python 3.12+
- Node.js 20+ and npm
- Docker Desktop with Compose
- Optional: Android Studio emulator, Xcode simulator or Expo Go for mobile

## Environment

From the repository root:

```powershell
Copy-Item .env.example .env
```

Fill in:

- `POSTGRES_PASSWORD` — a long random value.
- `JWT_SECRET_KEY` — generate with
  `python -c "import secrets; print(secrets.token_urlsafe(48))"`.
- `TEST_DATABASE_URL` — must end in `_test`.
- `REFRESH_COOKIE_SECURE=true` only when serving over HTTPS. Keep `false` for
  local HTTP.
- `AUTH_RATE_LIMIT_*` — authentication throttling; defaults to 10 requests per
  300 seconds. Disable only for controlled testing.
- `BANK_PROVIDER` — financial-data provider slug. Only `mock` is bundled.
- `BANK_SYNC_LOOKBACK_DAYS` — first-sync transaction lookback (default 120).

`.env` is gitignored. `.env.example` must stay placeholder-only.

## Docker stack (recommended)

```powershell
docker compose up -d --build
docker compose ps
docker compose logs -f backend
```

This starts:

- PostgreSQL 17 with a persistent named volume.
- The backend on port `8000`, waiting for a healthy database, running
  `alembic upgrade head`, then starting Uvicorn with reload.

> **Startup migrates automatically.** Because `alembic upgrade head` runs as
> part of the container command (in both `docker-compose.yml` and
> `backend/Dockerfile`), any pending revision in `backend/migrations/versions/`
> is applied the next time the stack starts or is rebuilt — without an approval
> step and without an automatic backup. This is how revision
> `0003_phase3_intelligence` reached the development database. Until the startup
> workflow is changed (proposed: drop `alembic upgrade head` from the container
> command and migrate explicitly after a verified backup), take the backup
> described in [`docs/database/schema.md`](../database/schema.md#migrations)
> before starting the stack with unreviewed migrations present.

Verify:

```powershell
Invoke-RestMethod http://localhost:8000/api/v1/health
```

Expected:

```json
{"status":"ok","database":"ok","version":"1.0.0","environment":"development"}
```

The PostgreSQL init script also creates `guardian_test` for PostgreSQL-backed
tests.

Stop the stack with `docker compose down`. Add `-v` only when you intend to
delete the database volume.

## Backend without Docker

Use this when PostgreSQL is already available.

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
.\.venv\Scripts\alembic upgrade head
.\.venv\Scripts\uvicorn app.main:app --reload --port 8000
```

`DATABASE_URL` must point at the local PostgreSQL instance. If the database runs
in the Docker stack, use `localhost:5432` and the credentials from `.env`.

## Web app

```powershell
cd frontend/web
npm install
npm run dev
```

Open <http://localhost:5173>. Vite proxies `/api/v1` to `http://localhost:8000`,
so cookies remain same-origin in development.

Useful commands:

```powershell
npm test -- --run
npm run test:watch
npm run lint
npm run build
npm run preview
```

## Mobile app

```powershell
cd mobile
npm install
npx expo start
```

Then press `a` for Android, `i` for iOS (macOS) or scan the QR code with Expo Go.

API URL:

- Emulator/simulator: default `http://localhost:8000/api/v1` usually works.
- Physical device: set a LAN URL before starting Expo:

  ```powershell
  $env:EXPO_PUBLIC_API_URL = "http://192.168.1.20:8000/api/v1"
  npx expo start
  ```

  The phone and computer must be on the same network, and the backend must be
  reachable on that interface. Native apps do not require CORS, but any browser
  preview does.

Checks:

```powershell
npx tsc --noEmit
npx expo export --platform web
```

`expo export` writes to `dist/` by default (ignored by Git). A static host needs
SPA fallback to `index.html` for direct deep links.

## Tests

Backend, isolated SQLite:

```powershell
cd backend
.\.venv\Scripts\python -m pytest -q
```

Backend, PostgreSQL:

```powershell
cd backend
$env:TEST_DATABASE_URL = "postgresql+psycopg://guardian:<password>@localhost:5432/guardian_test"
.\.venv\Scripts\python -m pytest -q
```

The test configuration refuses a `TEST_DATABASE_URL` that does not end in
`_test`.

Web:

```powershell
cd frontend/web
npm test -- --run
```

## Common issues

| Symptom | Likely cause |
|---|---|
| `POSTGRES_PASSWORD must be set` | `.env` missing or empty when running Compose |
| Backend exits at startup in production | Weak `JWT_SECRET_KEY` or insecure cookie flags |
| Browser request blocked by CORS | Origin missing from `CORS_ORIGINS` |
| Mobile cannot reach the API | Using `localhost` on a physical device; use the LAN IP |
| Refresh works on web but not mobile | Mobile refresh must send the refresh token in the request body; `X-Client-Platform` alone is not a credential |
| Authentication request returns `429` | The per-IP limit was reached; wait for `Retry-After` or tune `AUTH_RATE_LIMIT_*` |
| Direct mobile deep link returns 404 on a static host | Configure SPA fallback to `index.html` |
| Database schema drift | Run `alembic check`; generate a new revision instead of editing one |

## Ports

| Service | Port |
|---|---|
| Backend | 8000 |
| PostgreSQL | 5432 |
| Web (Vite) | 5173 |
| Expo web | 8081 |
