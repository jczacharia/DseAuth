import {test as base, expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

// Raw V8 coverage is dumped per test here; coverage-report.ts maps it through source maps to lcov.
export const RAW_DIR = join(import.meta.dirname, '..', 'coverage', 'e2e', '.v8');

// Auto fixture: collect Chromium V8 JS coverage for every test (coverage API is Chromium-only).
export const test = base.extend<{coverage: void}>({
  coverage: [
    async ({page, browserName}, use) => {
      const enabled = browserName === 'chromium';
      if (enabled) {
        await page.coverage.startJSCoverage({resetOnNavigation: false});
      }
      await use();
      if (!enabled) {
        return;
      }
      const entries = await page.coverage.stopJSCoverage();
      mkdirSync(RAW_DIR, {recursive: true});
      writeFileSync(join(RAW_DIR, `${randomUUID()}.json`), JSON.stringify(entries));
    },
    {auto: true},
  ],
});

export {expect};
