# Technology decisions

The application keeps business rules in pure TypeScript functions and uses Express HTTP adapters to validate input and call services. PostgreSQL transactions combine workflow changes with history and queued email. Prisma provides typed queries and reviewable SQL migrations.

Prisma 7 uses the PostgreSQL driver adapter and a separate `prisma.config.ts`. The dependency version was updated during verification to remove advisories present in the earlier dependency tree. See [Prisma's migration guide](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7).

React Router handles member/admin navigation. TanStack Query owns fetched data and invalidation. React Hook Form plus Zod provides form validation, while the server validates every payload independently.

## Deliberate differences from the supplied brief

- The supplied GitHub repository name is retained instead of creating a differently named repository.
- The UI uses custom CSS, native controls, and Lucide icons instead of Tailwind/shadcn. This keeps the design cohesive and the component surface small.
- Category distributions use native accessible meters rather than Recharts.
- Thin route handlers combine routing, validation, and HTTP response shaping. Services enforce rules; the request repository centralizes visibility filters and eager-loading projections.
- Attachments are stored as bounded PostgreSQL binary data instead of ephemeral local files. This makes the initial cloud deployment self-contained.
- Email delivery uses a transactional outbox with conditional worker leases. This is more reliable than sending inside the HTTP request transaction.
- Express serves the built SPA instead of using a separate nginx service, preserving same-origin sessions with fewer deployment components.

For larger teams, extract HTTP controllers, add a shared contract package, move files to object storage, and run notifications in a separately scaled worker.
