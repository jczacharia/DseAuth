import {CoverageReport} from 'monocart-coverage-reports';
import {existsSync, readdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {RAW_DIR} from './fixtures';

// Maps the raw Chromium V8 coverage through the e2e build's source maps into lcov. SonarQube unions
// this with the Vitest unit lcov (comma-separated sonar.javascript.lcov.reportPaths).
export default async function globalTeardown(): Promise<void> {
  if (!existsSync(RAW_DIR)) {
    return;
  }
  const files = readdirSync(RAW_DIR).filter((f) => f.endsWith('.json'));
  if (files.length === 0) {
    return;
  }

  const outputDir = join(import.meta.dirname, '..', 'coverage', 'e2e');
  const report = new CoverageReport({
    name: 'DSE E2E Coverage',
    outputDir,
    reports: ['lcovonly'],
    // Only script bundles carry coverage; drop the HTML document entry.
    entryFilter: (entry: {url: string}) => entry.url.endsWith('.js'),
    // First-party app source only; drop vendor chunks and generated/excluded code.
    sourceFilter: (sourcePath: string) =>
      sourcePath.includes('src/app/') &&
      !sourcePath.includes('node_modules') &&
      !sourcePath.includes('/app/api/') &&
      !sourcePath.includes('/app/ui/'),
  });

  for (const f of files) {
    await report.add(JSON.parse(readFileSync(join(RAW_DIR, f), 'utf8')));
  }
  await report.generate();
  rmSync(RAW_DIR, {recursive: true, force: true});

  // Bundles that ship without a usable source map bypass sourceFilter and leak in as raw chunk URLs;
  // keep only records that resolved to real source so the report stays honest.
  const lcovFile = join(outputDir, 'lcov.info');
  if (existsSync(lcovFile)) {
    const kept = readFileSync(lcovFile, 'utf8')
      .split('end_of_record\n')
      .filter((record) => /^SF:src\//m.test(record))
      .join('end_of_record\n');
    writeFileSync(lcovFile, kept ? `${kept}end_of_record\n` : '');
  }
}
