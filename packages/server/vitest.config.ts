import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20_000,
    hookTimeout: 30_000,
    // Integration tests share one Postgres; run files serially to avoid clashes.
    fileParallelism: false,
  },
});
