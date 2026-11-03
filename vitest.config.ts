import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Refuses to run any test file against a non-allowlisted DATABASE_URL (Finding C).
    setupFiles: ['./server/test-utils/vitest-db-guard.setup.ts'],
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
});
