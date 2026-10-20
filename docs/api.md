# API reference

Base URL: `http://localhost:4000/api`. Use JSON with `Content-Type: application/json`, except for multipart attachment uploads. Successful object responses use `{ "data": ... }`; paginated results include `meta`. Errors use `{ "error": { "code", "message", "details"? } }`.

| Method | Path                                      | Access                          | Result                                         |
| ------ | ----------------------------------------- | ------------------------------- | ---------------------------------------------- |
| POST   | `/auth/register`                          | Public, limited                 | Register member + session, 201                 |
| POST   | `/auth/login`                             | Public, limited                 | Session + user, 200                            |
| POST   | `/auth/logout`                            | Signed in                       | Delete session, 204                            |
| GET    | `/auth/me`                                | Signed in                       | Current user                                   |
| GET    | `/requests`                               | Signed in                       | Visible requests and pagination                |
| POST   | `/requests`                               | Signed in                       | New pending request, 201                       |
| GET    | `/requests/stats`                         | Signed in                       | Visible status/category counts                 |
| GET    | `/requests/:id`                           | Owner/admin                     | Details, actions, history, attachment metadata |
| PATCH  | `/requests/:id`                           | Owner, pending                  | Content update                                 |
| DELETE | `/requests/:id`                           | Owner pending/admin nonterminal | Soft cancel                                    |
| PATCH  | `/requests/:id/status`                    | Admin                           | Valid workflow transition                      |
| POST   | `/requests/:id/attachments`               | Owner, pending                  | Multipart `file`, 201                          |
| GET    | `/requests/:id/attachments/:attachmentId` | Owner/admin                     | Download bytes                                 |
| GET    | `/users`                                  | Admin                           | Paginated directory                            |
| PATCH  | `/users/:id`                              | Admin                           | Role/active-state update                       |
| GET    | `/health`                                 | Public                          | Database readiness                             |

## Filters

Requests: `page`, `limit` (1–100), `search` (title/description), `status`, `category`, `priority`, `sortBy` (`createdAt`, `updatedAt`, `priority`, `title`), `sortOrder` (`asc`, `desc`). Priority follows severity: LOW < MEDIUM < HIGH.

Users: `page`, `limit`, `search` (name/email), `role`, `isActive` (`true`/`false`).

## Examples

These examples use disposable placeholders. On PowerShell, invoke `curl.exe`.

```bash
curl -c cookies.txt -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"YOUR_LOCAL_PASSWORD"}' \
  http://localhost:4000/api/auth/login

curl -b cookies.txt -H "Content-Type: application/json" \
  -d '{"title":"VPN access issue","description":"The company VPN cannot establish a connection.","category":"TECHNICAL","priority":"HIGH"}' \
  http://localhost:4000/api/requests

curl -b cookies.txt "http://localhost:4000/api/requests?status=PENDING&sortBy=priority&sortOrder=desc"

curl -b cookies.txt -F "file=@evidence.pdf" \
  http://localhost:4000/api/requests/REQUEST_UUID/attachments

curl -b cookies.txt -X PATCH -H "Content-Type: application/json" \
  -d '{"status":"IN_PROGRESS","note":"Investigation started."}' \
  http://localhost:4000/api/requests/REQUEST_UUID/status

curl -b cookies.txt -X POST -H "Content-Type: application/json" -d '{}' \
  http://localhost:4000/api/auth/logout
```

Delete the local cookie jar after use; do not commit it.

## Errors

400 validation/JSON/file errors; 401 unauthenticated or invalid credentials; 403 wrong role/disabled account/untrusted origin; 404 absent or invisible resource; 409 workflow, ownership-state, duplicate email, or concurrent-change conflict; 413 oversized file; 415 unsupported body type; 429 auth rate limit; 500 unexpected server error.

Responses never include password hashes or stack traces. `allowedActions` is computed for the authenticated actor, and drives edit/cancel/status controls in the UI.
