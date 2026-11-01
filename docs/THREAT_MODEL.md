# Threat model

## Assets

- Passwords and password hashes
- Session tokens and CSRF tokens
- Event, guest, vendor and budget data (including contact details and accessibility notes)
- Integrity of money, feasibility and approval history
- Gemini API key and the contents of prompts
- Availability of the public demo and the API

## Actors

- Unauthenticated visitor (including the public demo user)
- Authenticated owner
- Another authenticated user attempting access to someone else's data
- Network attacker / malicious proxy
- Hostile text inside AI prompts (prompt injection)
- Operator making a deployment mistake

## Threats and mitigations

| Threat | Mitigation | Residual risk |
| --- | --- | --- |
| Credential stuffing | Argon2id, per-IP+email login limit, generic `invalid_credentials` | No MFA, no breached-password check |
| Account enumeration | Same error for missing account and wrong password; dummy hash verify | Signup reveals `email_taken` by design |
| Session theft | HttpOnly, Secure in production, SameSite=Lax, rotation on login, hashed tokens | No device binding; stolen cookie works until expiry/revocation |
| CSRF | HMAC double-submit header + cookie, constant-time compare, SameSite | XSS would defeat CSRF; CSP limits but does not eliminate script injection |
| XSS | React escapes by default, no `dangerouslySetInnerHTML`, JSON APIs, nosniff, strict same-origin CSP | Same-origin script compromise remains possible |
| Clickjacking | `X-Frame-Options: DENY` | None known for modern browsers |
| IDOR | Every query owner-scoped; other owners get `404` | A future endpoint could forget the scope; tests cover current routes |
| SQL injection | SQLAlchemy parameter binding; no string-built SQL with user input | Raw SQL additions must be reviewed |
| Mass assignment | Explicit Pydantic models; approval applies an allowlist | Direct setup endpoints intentionally accept their fields |
| Race / TOCTOU on approval | Event row `SELECT ... FOR UPDATE` on approval and snapshot-affecting writes; version check; baseline fingerprint; recompute from DB | Direct database edits bypass app locks |
| Replay of approval | Proposal status + `revision_id`; idempotent replay response | None known |
| Duplicate create on lost response | `Idempotency-Key` scoped to user, event/account, method and endpoint; same-fingerprint replay, different-payload `409`; transaction-coupled record | Keys are optional; a client that omits the header can still duplicate; records expire after 24 hours |
| Stale proposal applied | `base_version` check plus snapshot `baseline_hash`; `409 version_conflict` / `409 baseline_changed` | None known |
| Infeasible plan approved | Recompute at approval; reject with `422 infeasible_proposal` | None known |
| Prompt injection via facts or notes | Facts are data, system prompt says so, strict schemas, number grounding, no tools, no writes | Model can still produce misleading prose within allowed numbers |
| Cloud data leakage | Cloud off by default, explicit consent, fact sheet only, disclosure, no contacts or notes | Provider retention/abuse policies are outside this app |
| Silent cloud fallback | Local failure never selects cloud | Operator could enable cloud without users understanding; consent gate reduces this |
| API key exposure | Server-side env only, never sent to browser | No secret manager; env can leak via host compromise |
| Demo abuse | Separate router, no DB/auth/AI, per-IP limit, 64 KiB body cap | Single-process limiter; distributed abuse possible |
| DoS | Body cap, rate limits, provider timeouts | No WAF, no global concurrency limit, no CDN |
| Oversized payload | Middleware rejects `Content-Length` over 64 KiB | Chunked requests without length may bypass the early check; server limits still apply |
| Dependency compromise | Bounded/pinned ranges, lockfile for frontend | No automated scanning or SBOM |
| Log leakage | Request ids on responses; the default format prints the id; inbound ids sanitized; completion logs omit query strings, headers and bodies; library HTTP logs held at `WARNING`; production access logs disabled; no token logging | Unhandled exception tracebacks may include exception text; database backups contain data |
| Account deletion failure | Explicit consent delete + user delete cascade; password required | Backups retain data until expiry |
| Backup loss | Safe `pg_dump`/`pg_restore` runbook; isolated restore drill passed locally | No automated backup, off-host copy, encryption, retention or staging restore |
| Proxy IP masking | `TRUSTED_PROXY_IPS` enables right-to-left `X-Forwarded-For` parsing only from trusted peers | Operators must configure proxy IPs/CIDRs correctly; the proxy hop has not been exercised live |
| Misconfigured production | Startup rejects dev secret, short secret, insecure cookies, weak database passwords, SQLite, wildcard CORS, all-address trusted proxy and cloud without key; app sends HSTS | TLS termination and proxy configuration remain operator responsibilities |
| Multi-worker rate limit bypass | Image pins one worker; deployment docs forbid replicas without a shared store | Effective limit multiplies if an operator ignores the constraint |

## Out of scope

- Nation-state adversaries
- Physical access to the host
- Malicious database administrator
- Browser extension compromise
- Supply-chain attacks on the Python or Node ecosystems beyond normal pinning
- Payment fraud (payments are not implemented)

## Security decisions that must not regress

1. AI never mutates data and never produces authoritative totals.
2. Approval is locked, versioned, recomputed and idempotent.
3. Other users' resources return 404.
4. Guest-count changes cannot bypass review.
5. Production refuses insecure defaults.
6. The public demo has no path to user data, the database or AI.
