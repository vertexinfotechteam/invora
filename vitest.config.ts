import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['lib/calc/**', 'lib/ai/pricing.ts', 'lib/share/tokens.ts', 'lib/razorpay/verify.ts'],
      thresholds: {
        // The money engine is the one place we demand total coverage.
        'lib/calc/totals.ts': { branches: 100, functions: 100, lines: 100, statements: 100 },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // See tests/stubs/server-only.ts for why this is stubbed rather than
      // left to resolve to the real package.
      'server-only': path.resolve(__dirname, 'tests/stubs/server-only.ts'),
    },
  },
});
