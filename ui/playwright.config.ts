import {defineConfig, devices} from '@playwright/test';

// Lives at the SPA root so `npx playwright test` (run by the .NET orchestrator from ui) discovers
// it; testDir scopes runs to e2e/ only, never the Vitest unit specs under src/.
// The app is hosted by .NET (ApiHost/Kestrel), which seeds Elasticsearch and runs one scenario by
// @tag against the live URL — so no `webServer` here.
const baseURL = process.env.BASE_URL;
if (!baseURL) {
  throw new Error('BASE_URL must be set by the .NET orchestrator (ApiHost.BaseAddress).');
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: [['list']],
  globalTeardown: './e2e/coverage-report.ts',
  use: {
    baseURL,
    locale: 'en-US',
    colorScheme: 'dark',
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
  },
  projects: [{name: 'chromium', use: {...devices['Desktop Chrome']}}],
});
