import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'packages/*/src/**/*.test.{js,ts}',
      'packages/*/__tests__/**/*.test.{js,ts}'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['packages/*/src/**/*.{js,ts}'],
      exclude: ['**/*.test.{js,ts}', '**/dist/**', '**/node_modules/**']
    },
    testTimeout: 10000,
    pool: 'threads'
  }
});
