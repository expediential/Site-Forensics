import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    include: ['tests/unit/**/*.test.ts'],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      enabled: false,
    },
  },
});
