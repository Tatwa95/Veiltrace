import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/**/*.ts'],
      exclude: ['src/lib/sampleData.ts'],
      thresholds: {
        statements: 75,
        branches: 60,
        functions: 90,
        lines: 80,
      },
    },
  },
});
