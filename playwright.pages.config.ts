import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'pages-rev2.spec.ts',
  timeout: 60000,
  expect: { timeout: 30000 },
  retries: 1,
  use: { baseURL: 'http://127.0.0.1:4173' },
  projects: [
    { name: 'pc', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'smartphone', use: { viewport: { width: 390, height: 844 }, isMobile: true } },
  ],
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }], ['list']],
  outputDir: 'test-results/pages-rev2',
});
