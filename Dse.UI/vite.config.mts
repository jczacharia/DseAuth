/// <reference types="vitest" />

import angular from '@analogjs/vite-plugin-angular';
import viteTsConfigPaths from 'vite-tsconfig-paths';
import {defineConfig} from 'vitest/config';

// https://vitejs.dev/config/
export default defineConfig((cfg) => ({
  plugins: [angular({tsconfig: './tsconfig.spec.json'}), viteTsConfigPaths({projects: ['./tsconfig.spec.json']})],
  test: {
    globals: true,
    environment: 'jsdom',
    pool: 'vmThreads',
    setupFiles: ['src/testing/test-setup.ts'],
    include: ['src/**/*.spec.ts'],
    // Sonar test-execution report consumed by the enterprise pipeline (sonar.testExecutionReportPaths).
    reporters: ['default', ['vitest-sonar-reporter', {outputFile: 'coverage/ut_report.xml'}]],
    coverage: {
      provider: 'v8',
      enabled: cfg.mode === 'production',
      reportsDirectory: 'coverage',
      // lcovonly -> coverage/lcov.info (sonar.typescript.lcov.reportPaths); cobertura -> coverage/test-coverage.xml.
      reporter: ['text', 'html', 'lcovonly', ['cobertura', {file: 'test-coverage.xml'}]],
      include: ['src/**/*.ts'],
      // Generated Spartan UI primitives are vendored code; keep them out of coverage.
      exclude: ['src/**/*.spec.ts', 'src/testing/**', 'src/main.ts', 'src/app/ui/**'],
      // No thresholds here: gating is owned by the enterprise pipeline's Sonar quality gate, not the
      // local/`dotnet test` run. This keeps `dotnet test` (which runs Vitest via the hook) green on
      // passing tests regardless of coverage %, instead of failing the whole run below an arbitrary bar.
    },
  },
  define: {
    'import.meta.vitest': cfg.mode !== 'production',
  },
}));
