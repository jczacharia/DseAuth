/// <reference types="vitest" />

import angular from '@analogjs/vite-plugin-angular';
import viteTsConfigPaths from 'vite-tsconfig-paths';
import {defineConfig} from 'vitest/config';

// https://vitejs.dev/config/
export default defineConfig(({mode}) => ({
  plugins: [angular({tsconfig: './tsconfig.spec.json'}), viteTsConfigPaths({projects: ['./tsconfig.spec.json']})],
  test: {
    globals: true,
    watch: false,
    environment: 'jsdom',
    pool: 'vmThreads',
    setupFiles: ['src/testing/test-setup.ts'],
    include: ['src/**/*.spec.ts'],
    reporters: ['default', ['vitest-sonar-reporter', {outputFile: 'coverage/ut_report.xml'}]],
    coverage: {
      provider: 'v8',
      enabled: mode === 'production',
      reportsDirectory: 'coverage',
      reporter: ['text', 'lcovonly', ['cobertura', {file: 'test-coverage.xml'}]],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/testing/**', 'src/main.ts', 'src/app/ui/**', 'src/app/api/**'],
    },
  },
  define: {
    'import.meta.vitest': mode !== 'production',
  },
}));
