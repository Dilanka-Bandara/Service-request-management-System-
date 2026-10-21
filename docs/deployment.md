# Render deployment runbook

The Blueprint follows Render's [configuration reference](https://render.com/docs/blueprint-spec) and [environment/secrets guidance](https://render.com/docs/configure-environment-variables).

## Prerequisites

- A Render account connected to the supplied GitHub repository.
- The Blueprint selects **Free** web compute and **Free** PostgreSQL in Singapore for the assignment demo.
- For email delivery: a Resend API key and verified sender, entered directly in Render environment settings.

## Deploy

1. In Render, select **New → Blueprint**, choose this repository and `main`.
2. Review `render.yaml`, the resources, and prices before confirming deployment.
3. Set `CLIENT_ORIGIN` to the exact HTTPS web-service origin (no path). If Render assigns a different hostname, update this setting before testing mutations.
4. Email is optional during provisioning. To enable it, add `RESEND_API_KEY` and `MAIL_FROM` through Render's Environment page. Free web services block SMTP ports, so the application uses Resend over HTTPS when its key is configured. SMTP remains supported for local or paid hosting.
5. Deploy. The Docker image builds both workspaces; container startup applies migrations, runs the idempotent demo seed when `SEED_ON_START=true`, and starts Express. `/api/health` checks database connectivity.
6. The Blueprint generates private `SEED_ADMIN_PASSWORD` and `SEED_USER_PASSWORD` values in Render. Retrieve them from the service's Environment page. The admin email is `admin@example.com`; sample members are `alex@example.com` and `jamie@example.com`. These generated passwords never enter Git. Free services have no shell, so automatic first-start setup is enabled. Seeding preserves existing accounts and passwords on redeploy.

7. Sign in as admin and create a request. Confirm the dashboard, detail page, activity, file upload/download, status changes, and email receipt.
8. Restart/redeploy the service, then verify that attachments remain downloadable and sessions behave as expected.

## Operational checks

- Free web services sleep after 15 minutes idle; the next visit can take about a minute to start.
- Free PostgreSQL expires 30 days after creation. Export the demo data or upgrade before expiry if it must be retained.
- The email worker pauses while the free service sleeps. Queued messages resume when the service wakes.
- Free resources still count toward workspace bandwidth/build limits. See [Render's free-plan limits](https://render.com/docs/free).

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

The assignment demo is live at **https://resolve-service-requests.onrender.com**. Render deployed application commit `75c0da8` successfully; the public database health check and administrator login were verified on 21 October 2026. The free database expires on **20 November 2026**.

Retrieve the administrator password privately from `SEED_ADMIN_PASSWORD` in the Render service's Environment page; use `admin@example.com` to sign in. Do not copy generated credentials into Git or public assignment material.

Real email delivery remains pending: configure `RESEND_API_KEY` and a verified `MAIL_FROM` in Render. Notifications are queued until a provider is configured.
