import { defineConfig } from 'vitest/config';

// Node env for pure-logic tests (playback/replay). UI is validated by driving the
// real app in a browser; these lock the deterministic client-side replay contract.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
