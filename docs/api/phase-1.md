# API Reference — Phase 1

Base URL: `http://localhost:8000/api/v1`

Interactive OpenAPI docs: `/docs` (disabled when `ENVIRONMENT=production`).

## Conventions

- JSON request and response bodies.
- Protected routes require `Authorization: Bearer <access_token>`.
- Errors use:

```json
{ "detail": "Human-readable message", "code": "machine_code" }
```

Validation errors add a safe `errors` array. Submitted values, including
passwords, are never echoed.

| Status | Meaning |
|---|---|
| 400 | Bad request |
| 401 | Missing, invalid, expired or revoked authentication |
| 403 | Disabled account |
| 404 | Resource not found |
| 409 | Email already registered |
| 422 | Validation failure |
| 429 | Too many authentication requests; wait for `Retry-After` |
| 500 | Unexpected error; details are not exposed |

## Health

### `GET /health`

Public.

```json
{
  "status": "ok",
  "database": "ok",
  "version": "1.0.0",
  "environment": "development"
}
```

Returns `503` with `status: "degraded"` and `database: "unavailable"` if the
database cannot be reached.

## Rate limiting

`POST /auth/register`, `POST /auth/login` and `POST /auth/refresh` are limited
per client IP and action (10 requests per 300 seconds by default). Exceeding the
limit returns:

```json
{ "detail": "Too many requests. Please try again later.", "code": "rate_limited" }
```

The response includes a `Retry-After` header with the number of seconds to wait.
Allowed and failed requests both count toward the window, and each action has
its own bucket. Configure the limit with `AUTH_RATE_LIMIT_ENABLED`,
`AUTH_RATE_LIMIT_ATTEMPTS` and `AUTH_RATE_LIMIT_WINDOW_SECONDS`. The limiter is
in-process; multi-worker deployments should also limit at the edge.

## Authentication

### `POST /auth/register`

Public. Creates an account, preferences and a session.

```json
{
  "full_name": "Asha Verma",
  "email": "asha@example.com",
  "password": "Guardian123"
}
```

Rules:

- `full_name`: 2–120 characters; whitespace collapsed.
- `email`: valid address; normalised to lowercase; unique.
- `password`: 8–128 characters with at least one letter and one digit.

Response `201`:

```json
{
  "access_token": "<jwt>",
  "token_type": "bearer",
  "expires_in": 900,
  "refresh_token": null,
  "user": {
    "id": "5c1c2f5e-...",
    "full_name": "Asha Verma",
    "email": "asha@example.com",
    "is_active": true,
    "created_at": "2026-11-17T12:00:00Z",
    "updated_at": "2026-11-17T12:00:00Z",
    "preferences": {
      "currency": "INR",
      "timezone": "Asia/Kolkata",
      "theme": "system",
      "email_notifications": true,
      "push_notifications": true,
      "weekly_summary": false,
      "onboarding_completed": false
    }
  }
}
```

The refresh token is set as an `HttpOnly` cookie for browser clients. For
registration and login, mobile clients that send `X-Client-Platform: mobile`
receive it in `refresh_token` instead. A refresh request that authenticates
with the cookie never returns a refresh token in the body, even if that header
is present.

### `POST /auth/login`

Public. Same body shape as registration without `full_name`.

- `200` with the same token response.
- `401` `"Incorrect email or password"` for unknown emails or wrong passwords.
- `403` for a disabled account.
- Updates `last_login_at` on success.

Failed logins verify a dummy hash so response timing does not reveal whether an
email exists.

### `POST /auth/refresh`

Rotates the refresh token and returns a new access token.

- Browser: send the cookie automatically; no body required.
- Mobile: send `{ "refresh_token": "<token>" }`.

Response `200` has the same shape as login. A new `refresh_token` is included
only when the request supplied the refresh token in the JSON body. A
cookie-authenticated browser refresh never includes it, even when
`X-Client-Platform: mobile` is sent. The old token and its access tokens stop
working.

Errors:

- `401 Missing refresh token`
- `401 Invalid or expired session`
- `401 Session is no longer valid` (replayed revoked token; all user sessions
  are revoked)
- `401 Session has expired`
- `403` for a disabled account (all of its sessions are revoked)

### `POST /auth/logout`

Revokes the current session. Accepts an optional bearer access token and/or an
optional `{ "refresh_token": "..." }` body. Browsers normally rely on the
cookie. Returns `204` when the request is processed, including when the session
is already gone, and clears the refresh cookie. Unexpected server errors return
`5xx`; clients must not report a successful sign-out in that case.

### `GET /auth/me`

Bearer required. Returns the same `user` object shown above.

## Users

All routes require a bearer token and only ever operate on the caller's account.

### `GET /users/me`

Returns the authenticated user's profile and preferences.

### `PATCH /users/me`

```json
{
  "full_name": "Asha V. Verma"
}
```

Both fields are optional. `full_name` must be 2–120 characters. An optional
`preferences` object can be sent in the same request. Returns the updated user.

### `GET /users/me/preferences`

Returns:

```json
{
  "currency": "INR",
  "timezone": "Asia/Kolkata",
  "theme": "system",
  "email_notifications": true,
  "push_notifications": true,
  "weekly_summary": false,
  "onboarding_completed": false
}
```

### `PATCH /users/me/preferences`

Accepts any subset of the preference fields:

```json
{
  "theme": "dark",
  "email_notifications": false
}
```

Validation:

- `currency`: exactly 3 alphabetic characters; stored uppercase.
- `timezone`: must be a known IANA timezone.
- `theme`: `system`, `light` or `dark`.
- Booleans accept only JSON booleans.

Returns the complete updated preference object.

## CORS

Browser origins must be listed in `CORS_ORIGINS`. Credentials are allowed so the
refresh cookie can be used. Development defaults include
`http://localhost:5173`, `http://127.0.0.1:5173` and `http://localhost:8081`.

## Security headers

API responses include `X-Content-Type-Options: nosniff`, `X-Frame-Options:
DENY`, `Referrer-Policy: no-referrer` and a restrictive `Permissions-Policy`.
Production adds `Strict-Transport-Security`.
