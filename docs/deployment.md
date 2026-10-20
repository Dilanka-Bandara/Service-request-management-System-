# Render deployment runbook

The Blueprint follows Render's [configuration reference](https://render.com/docs/blueprint-spec) and [environment/secrets guidance](https://render.com/docs/configure-environment-variables).

## Prerequisites

- A Render account connected to the supplied GitHub repository.
- Approval of the service and database plans shown by Render. The Blueprint selects Starter web compute and Basic PostgreSQL in Singapore.
- An SMTP provider with a verified sender and credentials.

## Deploy

1. In Render, select **New → Blueprint**, choose this repository and `main`.
2. Review `render.yaml`, the resources, and prices before confirming deployment.
3. Set `CLIENT_ORIGIN` to the exact HTTPS web-service origin (no path). If Render assigns a different hostname, update this setting before testing mutations.
4. Enter `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD`, and `MAIL_FROM` in Render. The default is STARTTLS on port 587; for port 465 also set `SMTP_SECURE=true`.
5. Deploy. The Docker image builds both workspaces; container startup applies migrations and then starts Express. `/api/health` checks database connectivity.
6. In the Render shell, set `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, and `SEED_USER_PASSWORD` as temporary environment values, then run:

   ```bash
   node server/dist/prisma/seed.js
   ```

   This creates demonstration data as well as the admin. Remove seed credentials from Render after setup if they were saved in environment settings. The application does not require them at runtime.

7. Sign in as admin and create a request. Confirm the dashboard, detail page, activity, file upload/download, status changes, and email receipt.
8. Restart/redeploy the service, then verify that attachments remain downloadable and sessions behave as expected.

## Operational checks

- Use HTTPS and `NODE_ENV=production`; cookies then have `Secure`.
- Keep the database private; the Blueprint uses `ipAllowList: []`.
- `TRUST_PROXY=true` assumes one trusted proxy in front of Express.
- Never put SMTP/database passwords in the repository, build arguments, screenshots, or issue comments.
- Back up PostgreSQL, including attachment content. Set a retention policy appropriate to your organization.
- Outbox records with `sentAt IS NULL AND attempts >= 10` need operator attention. After fixing the provider issue, reset their attempts and availability through an authenticated database administration session.
- Keep one instance initially. Multiple workers use leases, but auth rate limiting still uses per-process memory.

## Rollback

Render can redeploy a previous application commit. Database migrations are forward-only; review schema compatibility before rollback. Restore a database backup only through a separately approved recovery procedure.

## Current completion boundary

This repository provides deployable configuration and a runbook. An actual Render deployment, a public URL, and real SMTP delivery require account access/provider credentials and must be verified after provisioning.
