# Web Application

React 19 + TypeScript + Vite client for AI Payment Guardian.

Phase 1 provides the Welcome, Register, Login, Dashboard, Profile and Settings
screens. The dashboard intentionally shows no financial data; it explains
onboarding and the future bank connection.

## Run

```powershell
npm install
npm run dev
```

Open <http://localhost:5173>. The Vite dev server proxies `/api/v1` to the
backend at `http://localhost:8000`, keeping the refresh cookie same-origin. Set
`VITE_API_BASE_URL` only when you need to bypass the proxy.

The backend must be running and its `CORS_ORIGINS` must include the web origin.

## Checks

```powershell
npm test -- --run   # Vitest + Testing Library
npm run lint        # oxlint
npm run build       # tsc -b && vite build
```

## Structure

```
src/
├── app/            Router composition
├── components/     Layout and UI primitives
├── features/auth/  Auth context and validation
├── pages/          Route screens
├── services/       Axios client and API wrappers
├── hooks/          Document title, theme
├── utils/          Formatting, errors, class names
└── __tests__/      Unit and component tests
```

## Session model

- The access token is kept in memory in `src/services/apiClient.ts`.
- The refresh token is an `HttpOnly` cookie; JavaScript never reads it.
- A 401 triggers a single refresh-and-retry. If refresh fails, auth state is
  cleared and protected routes redirect to `/login`.
- Nothing sensitive is stored in `localStorage`.

See `../docs/security/authentication.md` for the full model.
