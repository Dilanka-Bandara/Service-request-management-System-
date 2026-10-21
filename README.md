# Resolve · Service Request Management

[![CI](https://github.com/Dilanka-Bandara/Service-request-management-System-/actions/workflows/ci.yml/badge.svg)](https://github.com/Dilanka-Bandara/Service-request-management-System-/actions/workflows/ci.yml)

A full-stack workspace for submitting, tracking, and resolving service requests. Members manage their own requests; administrators coordinate the queue and manage account access. Business rules, authorization, audit history, and notification creation are enforced by the API.

**[Open the live assignment demo](https://resolve-service-requests.onrender.com)** · Hosted on Render Free. The first visit after idle may take about a minute. The demo database expires on **20 November 2026**. See the [deployment runbook](docs/deployment.md) for private login credentials and email setup.

![Administrator dashboard](docs/screenshots/dashboard.png)

## Features

- Registration, login, opaque server-side sessions, and immediate logout.
- Member and administrator dashboards with status counts and category distributions.
- Search, combined filters, sorting, and pagination with shareable URLs.
- Pending-only content editing, controlled status transitions, soft cancellation, and activity timelines.
- Administrator account activation and role changes with self/last-admin protections.
- Authorized PDF, PNG, and JPEG uploads and downloads: five files per request, 5 MiB per file.
- Persistent email outbox for request creation and status changes, with HTTPS (Resend) or SMTP delivery and retry.
- Responsive layouts, dark mode, inline form validation, confirmations, and feedback states.
- OpenAPI/Swagger documentation, Postman collection, PostgreSQL migrations, Docker, CI, and a Render Blueprint.

## Technology choices and reasons

| Layer          | Choice                               | Reason                                                          |
| -------------- | ------------------------------------ | --------------------------------------------------------------- |
| Language       | Strict TypeScript                    | Consistent types across the API and UI                          |
| API            | Express 5 + Zod                      | Explicit HTTP middleware and validated inputs                   |
| Database       | PostgreSQL + Prisma                  | Relational integrity, transactions, migrations, typed access    |
| Authentication | Argon2id + database sessions         | Strong password hashing and immediate revocation                |
| Frontend       | React + Vite + React Router          | Fast development and clear client-side routes                   |
| Data/forms     | TanStack Query + React Hook Form     | Cache invalidation, pending states, and validated forms         |
| UI             | Custom CSS + Lucide + Sonner         | A small, coherent interface without a large component framework |
| Email          | Nodemailer + transactional outbox    | Durable delivery requests and bounded retries                   |
| Verification   | Vitest + Supertest + Testing Library | Pure-rule tests plus HTTP tests against PostgreSQL              |
| Deployment     | Docker + Render                      | One same-origin service and a managed database                  |

See [technology decisions](docs/TECH_STACK.md) for tradeoffs and differences from the supplied brief.

### Why PostgreSQL?

Users, requests, sessions, attachments, and audit events have clear relationships. Foreign keys protect those relationships, enums constrain workflow values, and transactions keep updates and their history consistent. Conditional writes and row locks handle concurrent status changes and attachment limits. PostgreSQL 16 runs in Docker and CI; a local PostgreSQL 17 instance was also used during development.

## Architecture

```mermaid
flowchart LR
  UI["React SPA"] -->|"same-origin /api; httpOnly cookie"| API["Express routes / HTTP adapters"]
  API --> Services["Services: permissions and transactions"]
  Services --> Domain["Pure workflow and permission rules"]
  Services --> Data["Prisma queries / request repository"]
  Data --> PG[("PostgreSQL")]
  Worker["Email outbox worker"] --> PG
  Worker --> SMTP["SMTP provider"]
```

`client/src/features/api.ts` owns server-state hooks; `client/src/lib/api.ts` handles credentialed requests and structured errors. Backend routes validate HTTP input and invoke services. Domain functions define status and permission rules without Express or database dependencies. Services combine database writes, audit history, and notification outbox entries in transactions.

See the [database schema and indexes](docs/database.md).

## Local setup

Requirements: **Node.js 22.20+**, npm, Git, and Docker Desktop (or a PostgreSQL instance).

1. Clone and install:

   ```bash
   git clone https://github.com/Dilanka-Bandara/Service-request-management-System-.git
   cd Service-request-management-System-
   npm ci
   ```

2. Copy `.env.example` to `.env`. On PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

   Set `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, and `SEED_USER_PASSWORD`. Seed passwords must contain at least 12 characters. **Do not commit `.env` or put real credentials in documentation.**

3. Start PostgreSQL, migrate, and seed:

   ```bash
   docker compose up -d db
   npm run db:migrate
   npm run db:seed
   ```

4. Start both development servers:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:5173](http://localhost:5173). The API listens on port 4000. Vite proxies `/api` so browser cookies stay same-origin.

If port 5432 is already used, configure another port in Compose and both database URLs. Existing local databases are never reset by the setup command.

### Demo accounts

The seed creates an admin at `SEED_ADMIN_EMAIL`, plus `alex@example.com` and `jamie@example.com`. Use the passwords you chose in `.env`; none are stored in the repository. Seeding is idempotent and does not overwrite existing passwords. It creates 30 sample requests only if the requests table is empty.

### Full application in Docker

```bash
docker compose --profile full up --build
```

Open [http://localhost:4000](http://localhost:4000). This local container uses development cookie settings from `.env`; Render overrides `NODE_ENV=production` and uses HTTPS. Migrations run before the server starts. The React build and API are served by the same Express process.

### Production build without Docker

```bash
npm run build
npm start
```

The built server also serves the React SPA. Set `CLIENT_ORIGIN` to the public origin and `NODE_ENV=production` behind HTTPS.

## Environment variables

| Variable                     | Purpose                                                                    |
| ---------------------------- | -------------------------------------------------------------------------- |
| `DATABASE_URL`               | PostgreSQL application connection                                          |
| `DATABASE_URL_TEST`          | Dedicated `srm_test` connection; tests refuse any other database name      |
| `NODE_ENV`                   | `development`, `test`, or `production`; production enables secure cookies  |
| `PORT`                       | HTTP port, default 4000; Render supplies its port                          |
| `CLIENT_ORIGIN`              | Exact browser origin allowed to mutate data                                |
| `SESSION_TTL_HOURS`          | Fixed session lifetime, default 24                                         |
| `TRUST_PROXY`                | `true` only behind one trusted proxy                                       |
| `SEED_ADMIN_EMAIL`           | Administrator email used by the seed                                       |
| `SEED_ADMIN_PASSWORD`        | Administrator seed password; never committed                               |
| `SEED_USER_PASSWORD`         | Password for the two sample members; never committed                       |
| `SMTP_HOST`, `SMTP_PORT`     | SMTP server and port; default port 587                                     |
| `SMTP_SECURE`                | `true` for implicit TLS, normally port 465; otherwise STARTTLS is required |
| `SMTP_USER`, `SMTP_PASSWORD` | Provider credentials, stored locally or in Render secrets                  |
| `MAIL_FROM`                  | Sender address verified with the SMTP provider                             |
| `RESEND_API_KEY`             | Optional HTTPS email provider key; required instead of SMTP on Render Free |
| `SEED_ON_START`              | Enable idempotent demo seeding during container startup                    |

All `.env` variants are ignored at every directory level, except `.env.example`. Docker also excludes them. CI rejects accidentally tracked environment files.

## Authentication and authorization

Passwords use Argon2id. Login returns a 256-bit random opaque session token in an `httpOnly`, `SameSite=Lax` cookie (`Secure` in production); the database stores only its SHA-256 hash. Every authenticated request loads the current role and active state from PostgreSQL. Logout removes the session. Deactivation removes all user sessions and prevents login.

JSON mutations require `application/json`. State-changing requests validate the `Origin` and reject cross-site Fetch Metadata, including multipart uploads. CORS is limited to `CLIENT_ORIGIN`. This deployment assumes the frontend and API share an origin. Auth endpoints are rate limited, and logs redact cookies and authorization headers.

## Assumptions and business rules

1. Registration always creates a member and also signs them in. Client-supplied `role` and initial `status` fields are ignored.
2. Members see only their requests. Another member’s request returns 404 to avoid revealing its existence.
3. Only the owner may edit request content, and only while pending. Administrators manage other users’ requests through status changes.
4. Members may cancel pending requests. Administrators may cancel pending or in-progress requests.
5. Workflow: `PENDING → IN_PROGRESS → RESOLVED`, with cancellation from either nonterminal state. Resolved and cancelled states are terminal.
6. `PATCH` updates selected fields. `DELETE /api/requests/:id` means **soft cancellation**, preserving the audit trail.
7. Status writes use a conditional update. Stale changes return 409. History and notification records commit with the change.
8. Administrators cannot demote or deactivate themselves. Serialized admin changes preserve an active administrator.
9. Attachments may be added by the owner while pending. Downloads require the same visibility permission as the request.
10. Email is queued for the owner on creation and status changes. No email is sent until Resend or SMTP and a verified sender are configured.

## API documentation

- [Interactive Swagger](http://localhost:4000/api/docs)
- [OpenAPI JSON](http://localhost:4000/api/docs/openapi.json)
- [API reference and examples](docs/api.md)
- [Postman collection](docs/postman_collection.json)
- [Exported OpenAPI](docs/openapi.json)

Sign in through Swagger first to establish the browser cookie. For mutations without a body, send `{}` with `Content-Type: application/json`.

## Tests and quality checks

Create/migrate the **separate** test database before running the suite:

```powershell
# Docker's initialization script creates srm_test on a fresh volume.
# Point migration only at that test database for this command.
$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/srm_test"
npm run db:migrate
Remove-Item Env:DATABASE_URL
npm run lint
npm run typecheck
npm test
npm run build
```

Tests read `DATABASE_URL_TEST` from `.env`. The test suite clears only `srm_test`; never point it at real data. CI performs the same checks against PostgreSQL 16.

Coverage includes all 16 status transitions, owner/admin permission combinations, password validation, authentication, session revocation, user management, request filtering, workflow errors, upload type/size checks, download permissions, and frontend status/form validation. See [verification notes](docs/verification.md).

## Render deployment

See [the deployment runbook](docs/deployment.md). `render.yaml` provisions a **Free** Docker web service and **Free** PostgreSQL 16 database in Singapore for the assignment demo. Render generates private seed passwords. Add an optional Resend API key and verified sender through Render’s environment settings to enable email over HTTPS.

Free hosting sleeps after idle periods, and its database expires after 30 days. It blocks SMTP ports, so this deployment uses the HTTPS email option. See [Render's free-plan limits](https://render.com/docs/free).

**Deployment configuration is included; a live production URL is not claimed until an account deployment has completed.**

## Known limitations

- Files are bounded and signature checked, but there is no antivirus scanning or content sanitization. Files download as attachments and are never served as active HTML.
- Database-backed files are convenient for this assignment but increase backup size; use object storage plus signed access for large deployments.
- SMTP delivery is at least once: a crash after delivery but before recording success can produce a duplicate. Delivery stops after ten attempts; operators must inspect and retry failed outbox records.
- Rate limits are per process; use shared storage when scaling horizontally.
- Sessions expire after a fixed lifetime; there is no password reset, email verification, or idle-session extension.
- Search uses case-insensitive substring matching rather than a full-text index.
- Google Fonts are optional network assets; system fonts provide fallback.
- A production email delivery smoke test and Render account deployment need real provider configuration.

## Future improvements

Object storage, malware scanning, password recovery, email verification, shared rate limiting, full-text search, notification administration, audit export, and Playwright CI journeys.

## Demonstration

Screenshots are in [docs/screenshots](docs/screenshots). A 3–5 minute narrated demo video remains a submission task for the project owner; no fabricated link is included.
