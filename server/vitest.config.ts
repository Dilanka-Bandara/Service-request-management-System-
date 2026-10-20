import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL:
        process.env.DATABASE_URL_TEST ?? 'postgresql://postgres:postgres@localhost:5432/srm_test',
    },
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
