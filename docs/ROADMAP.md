# Roadmap

## Shipped in 0.1.0

- Authentication with Argon2id, opaque sessions, rotation, CSRF, rate limits, account deletion
- Owner-scoped events, ceremonies, budget items, guests, vendors, quotes, tasks, dependencies
- Deterministic planning engine: totals, reserve, shortfall, alternatives, timeline projection, cycle detection
- Simulation with no writes
- Proposals with feasibility gate, approval transaction, rejection, idempotent replay
- Immutable revisions and versioned JSON export
- Guest-count and event-date changes forced through proposals, with task and ceremony synchronization
- Saved-but-not-refreshed handling with retry-safe forms
- Idempotent create retries using database-backed keys
- Public read-only demo with a versioned synthetic fixture and golden test
- Optional Ollama and Gemini AI: explain, preferences, directions; consent; grounding; deterministic fallback
- Real-PostgreSQL test suite, live HTTP smoke, Docker image, compose stack, CI workflow
- Component tests and Playwright E2E in Chromium, Firefox and WebKit
- Safe backup/restore runbook with an isolated local restore drill
- Documentation under `docs/`

## Next, if the project continues

1. Wire the Playwright browser E2E into CI with a PostgreSQL service.
2. Live Gemini verification with a real key and recorded results.
3. Public deployment with HTTPS, managed PostgreSQL, automated backups, monitoring and a staging restore drill.
4. Manual screen-reader walkthrough (axe is already in the browser suite).
5. Live trusted-proxy validation and a shared rate-limit store for multi-worker deployments.
6. Automated cleanup of expired idempotency records.
7. Coverage measurement and a small performance baseline.
8. Budget item edit history and a guard for direct budget/reserve edits, if review coverage should expand beyond guest count.

## Deliberately deferred

These are not partially implemented; they are absent.

- PDF/OCR quote extraction
- File uploads of any kind
- Vendor research, discovery or marketplace
- RSVP website or guest-facing invitations
- Payments or deposits
- Multi-user collaboration, sharing or roles
- Notifications and reminders
- Mobile apps
- Real-time updates/websockets
- Retrieval-augmented generation, embeddings or a vector database
- Agent frameworks, tool-using agents, background queues
- Dashboard and Studio implementation (dashboard visual design is complete in `docs/design/dashboard`; Studio visual design remains deferred)
- Internationalisation, multi-currency conversion, tax handling

## Explicitly not planned

Microservices, event sourcing, CQRS, a separate AI service, Kubernetes manifests, or a browser→Ollama bridge. None are justified by the current workload.
