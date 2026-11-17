# Authentication and Security — Phase 1

Phase 1 protects accounts and sessions only. No financial data or bank
credentials exist in the system yet, and the application never asks for banking
passwords, UPI PINs, OTPs or card CVVs.

## Passwords

- Hashed with **Argon2id** through `pwdlib.PasswordHash.recommended()`.
- Plain-text passwords are never persisted or logged.
- Login failures return the same message for unknown emails and wrong passwords.
- Unknown emails are checked against a fixed dummy hash so timing does not leak
  account existence.
- Validation errors return field locations and messages but strip submitted
  values, which could contain a password.
- Registration requires 8–128 characters with at least one letter and one digit.
  Email uniqueness is enforced by the database as well as the service.

## Access tokens

- Short-lived JWTs (15 minutes by default), signed with `JWT_SECRET_KEY`.
- Claims: `sub` (user ID), `sid` (session ID), `type=access`, `iat`, `exp`,
  `jti`.
- Signature, expiry and token type are verified on every protected request.
- The referenced session must exist, belong to the same user, be unrevoked and
  be unexpired. This means logout and rotation invalidate access tokens
  immediately instead of waiting for JWT expiry.
- Disabled users are rejected with `403`.

## Refresh tokens and sessions

- 48 random bytes generated with `secrets.token_urlsafe`.
- Only the SHA-256 hash is stored in `auth_sessions`.
- Every refresh revokes the current session row and creates a new one
  (**rotation**), so a stolen token has a narrow useful window.
- Presenting an already-revoked token is treated as possible theft and revokes
  **all** sessions for that user.
- Sessions expire after 7 days by default and record user agent and IP address.
- Logout revokes by refresh token and/or by the `sid` in the access token.

## Web credential storage

- Access token: in memory only, inside the API client module. It is lost on
  reload and restored through refresh.
- Refresh token: `HttpOnly` cookie named `guardian_refresh`, scoped to
  `/api/v1/auth`, `SameSite=Lax`, `Secure` configurable.
- Nothing sensitive is written to `localStorage` or `sessionStorage`.
- JavaScript cannot read the refresh cookie, which limits the impact of XSS on
  refresh credentials.
- Development uses Vite's same-origin proxy so the cookie is first-party and is
  sent on refresh and logout.

Deployment notes:

- Set `REFRESH_COOKIE_SECURE=true` behind HTTPS. Production startup rejects
  `false`.
- `SameSite=None` is only allowed together with `Secure`.
- If the web app and API are served from different sites, cookie behaviour and
  CORS must be reviewed together.

## Mobile credential storage

- Access token: in memory only.
- Refresh token: `expo-secure-store`, backed by the iOS keychain or Android
  keystore, with `AFTER_FIRST_UNLOCK` accessibility.
- The refresh token is returned in JSON only when the client sends
  `X-Client-Platform: mobile`; browsers receive `null` in the body.
- The Expo web preview has no SecureStore, so it keeps the refresh token in
  memory for that session only. This is a preview concession, not the native
  behaviour.

## Session lifecycle

1. Register or login creates a session and returns a short-lived access token.
2. A protected request validates both the JWT and the session row.
3. On `401`, the client refreshes once and retries the request once.
4. If refresh fails, local credentials are cleared and the UI returns to sign-in.
5. Logout revokes the session server-side, clears the cookie or SecureStore entry
   and clears in-memory state. The web app shows a confirmation notice.

## Transport and headers

- CORS is restricted to configured origins with credentials enabled.
- Allowed headers are limited to `Authorization`, `Content-Type` and
  `X-Client-Platform`.
- Responses set `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: no-referrer` and a restrictive `Permissions-Policy`.
- Production adds HSTS and disables OpenAPI docs endpoints.
- Production startup refuses a default/weak `JWT_SECRET_KEY` or an insecure
  refresh cookie.
- Unexpected exceptions are logged server-side and returned as a generic
  message; internal details are never sent to clients.

## Data isolation

- Every protected route resolves the `User` from the authenticated session.
- Profile and preference reads and writes use that user object; no endpoint takes
  a user ID from the request body or path.
- Session lookup verifies that the session's `user_id` matches the token's
  `sub`.

## Not implemented in Phase 1

- Password reset and change-password flows.
- Email verification.
- Multi-factor authentication.
- Login rate limiting and account lockout (a `RateLimitError` type is reserved).
- Account deletion and data export.
- Audit log UI.
- Device/session management UI.

These are intentionally deferred. They must not be described as available.
