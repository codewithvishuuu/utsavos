# Authentication and security

## Passwords

- Argon2id through `argon2-cffi`'s `PasswordHasher` defaults.
- Hashes are re-computed on successful login when the library reports a newer parameter set.
- Policy: 10–128 characters, no leading or trailing whitespace.
- Login for a missing account runs a dummy verify (`burn_password_check`) so response time does not reveal whether the email exists.
- Password hashes are never returned by any endpoint.

## Sessions

- Opaque random token: `secrets.token_urlsafe(32)`.
- Only a SHA-256 hash is stored in `sessions.token_hash`.
- TTL: 14 days (`SESSION_TTL_SECONDS`).
- Login rotates the session: the previous cookie's row is deleted and a new token is issued.
- Logout sets `revoked_at` and clears cookies.
- Every request checks revocation and expiry.
- Session rows cascade when the user is deleted.

## Cookies

| Cookie | HttpOnly | Purpose |
| --- | --- | --- |
| `utsavos_session` | yes | Session token |
| `utsavos_csrf` | no | Double-submit CSRF token |

Both use `SameSite=Lax`, `Path=/`, and `Secure` in production (or when `SESSION_COOKIE_SECURE=true`). When Secure is on, the session cookie is named `__Host-utsavos_session`; `__Host-` requires Secure, Path=/, and no Domain.

`SESSION_COOKIE_SECURE` exists for local development over plain HTTP. Production
rejects `SESSION_COOKIE_SECURE=false`; use `APP_ENV=development` for HTTP-only local
runs. Logout deletes both cookies with the same `Path=/`, `SameSite=Lax`, and
`Secure` attributes used to set them (session also `HttpOnly`).

## CSRF

The CSRF token is `HMAC-SHA256(APP_SECRET_KEY, session_id)`. It is delivered in a readable cookie and must also appear in the `X-CSRF-Token` header on every authenticated non-safe request. The server compares both against the expected value with `hmac.compare_digest`. Failure is `403 csrf_failed`.

## Idempotency keys

Create requests may send `Idempotency-Key` (1–255 visible ASCII characters, codes
33–126). Records are unique per user, event/account scope, method, endpoint and key; a key from one
account or event cannot expose another owner's stored response. The key is not an
authorisation token: the normal session, ownership and CSRF checks still run. Invalid
keys return `422 invalid_idempotency_key`. See
[API.md](API.md#idempotent-mutation-retries) for replay and conflict semantics.

## Rate limits

| Scope | Key | Default |
| --- | --- | --- |
| Signup | client IP | 10/min |
| Login (per IP) | client IP | 30/min |
| Login (per account) | normalised email (lower-cased, trimmed) | 5/min |
| Public demo | client IP | 30/min |

Login has two independent fixed windows so neither bypass works: rotating email
targets from one address hits the per-IP window (password spraying), and rotating
source IPs against one account hits the per-account window (brute force). The
per-account key is only the normalised email, held in the limiter's in-process
memory; it never appears in logs, responses or error messages. Successful and
failed logins both consume the account window, so a victim account can be locked
for at most the current window — acceptable for an in-process limiter.

Fixed-window in-process limiter. `shortcut:` marker in `security/rate_limit.py`: one process only; a multi-worker deployment needs a shared store. Because the limiter is in-process, running multiple workers multiplies the effective limit.

`client_ip` uses the socket peer address. It reads `X-Forwarded-For` only when the
peer matches `TRUSTED_PROXY_IPS` (comma-separated IPs or CIDRs), walking the chain
from the right and skipping trusted hops. Leave it empty when the app is exposed
directly; otherwise per-IP limits key on the proxy address.

## Authorisation

Every event query includes `user_id = current_user.id`. A row belonging to another user is treated as missing: `404 not_found`, never `403`. Proposals and revisions are loaded through the owned event, then checked for `event_id` equality.

## Account deletion

`DELETE /auth/account` requires the current password. It deletes consent records explicitly, deletes the user, and relies on `ON DELETE CASCADE` for sessions, events and all child rows. Cookies are cleared. There is no soft-delete or recovery window.

## Request and response hardening

- Maximum request body: 64 KiB (`MAX_REQUEST_BYTES`), checked before routing; `413 payload_too_large`.
- Headers on all responses: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy` disabling geolocation, microphone and camera, and a strict Content-Security-Policy (omitted only for the dev-only Swagger page).
- CSP: `default-src 'self'`, `script-src 'self'`, `style-src 'self'`, `connect-src 'self'`, `img-src 'self' data:`, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`. No inline script, inline style or `eval`. The SPA uses external Vite assets and same-origin API calls. `/api/docs` is exempt outside production because Swagger UI loads CDN and inline assets; production disables the route.
- `X-Request-ID` on every response; errors carry the same id. Inbound values are accepted only when they match the bounded token pattern; they are correlation only, never authentication, and invalid values are replaced. Unhandled `500` responses apply the same security and cache headers as normal API responses and log the matching id.
- Production sends `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  (configurable with `HSTS_MAX_AGE_SECONDS`).
- Production startup rejects the development secret, secrets shorter than 32 characters,
  insecure session cookies, SQLite, wildcard CORS, weak/default database passwords,
  an all-address `TRUSTED_PROXY_IPS` wildcard, and cloud AI without a key.
- CORS is enabled only outside production, for `CORS_ORIGINS` (default `http://localhost:5173`).
  Its allow-list includes `Idempotency-Key` for the create endpoints.

## Known gaps

- No email verification, password reset, MFA, or session management UI.
- Rate limiting is per process.
- Idempotency records expire after 24 hours but cleanup is an operator task; there is no
  scheduler in the app.
- No automated dependency or container scanning in CI.
- Secrets are environment variables; there is no secret manager integration.
- The app does not encrypt data at rest; rely on the database provider or disk encryption.

See [THREAT_MODEL.md](THREAT_MODEL.md) for the threat-by-threat view.
