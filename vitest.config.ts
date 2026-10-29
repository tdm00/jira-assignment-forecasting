import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { appRevision } from './scripts/app-revision.ts';

const appVersion = appRevision();

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/integration/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    env: { TZ: 'America/New_York' },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/vite-env.d.ts'],
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        'src/core/**': { lines: 90, functions: 90 },
        'src/parsers/**': { lines: 90, functions: 90 },
      },
    },
  },
});
