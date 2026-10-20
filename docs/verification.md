# Verification

Verified on 21 October 2026:

- 58 backend tests and 5 frontend tests pass from a fresh local clone.
- The fresh clone produces the production client and server builds.
- GitHub Actions [run 39439331129](https://github.com/Dilanka-Bandara/Service-request-management-System-/actions/runs/39439331129) passed all checks, including PostgreSQL 16 tests and the dependency audit.
- Only `.env.example` is tracked. A tracked-file scan confirmed the local seed passwords are absent from committed files.

## Automated

- All 16 workflow state pairs and owner/non-owner/admin permission combinations.
- Password policy and pagination boundary calculations.
- Real PostgreSQL HTTP integration tests: registration, duplicate/invalid inputs, role stripping, httpOnly session cookie, authentication, logout, and disabled-account revocation.
- Request creation/history/outbox, ownership isolation, editing, combined search/filter/sort, pagination, statistics, cancellation, and terminal-state rejection.
- File signature checks, size limit, authorized download and foreign-user denial.
- Cross-origin JSON/multipart rejection and structured route/JSON errors.
- Concurrent identical status updates commit once; concurrent uploads respect the five-file cap.
- Outbox delivery success, retries, and unconfigured-provider behavior with a mocked SMTP transport.
- Frontend status text, rendered form validation, and member/admin route protection.
- Lint, strict TypeScript, and production builds.

## Browser smoke test

The local application was exercised through the browser: administrator login, seeded dashboard, request creation, and confirmed status transition with visible audit history. Desktop and 360px layouts were inspected. Screenshots contain only generated demonstration data.

## Environment

Development verification used Node 22 and an isolated PostgreSQL 17 instance on a loopback port. CI uses the required PostgreSQL 16 service. Docker Desktop did not provide a responding Linux engine during local setup, so a local container build is not reported as verified.

## External checks

Real SMTP delivery and a live Render deployment require provider configuration. Repository configuration alone is not evidence of successful cloud deployment.
