import { defineConfig } from 'prisma/config';
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Generation does not connect; migrations receive the validated deployment URL.
  datasource: { url: process.env.DATABASE_URL ?? 'postgresql://postgres@localhost:5432/srm_dev' },
});
