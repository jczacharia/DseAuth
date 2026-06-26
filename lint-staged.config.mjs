import {relative} from 'node:path';

/**
 * Root-orchestrated lint-staged. Runs from the repo root (git root).
 * ESLint stays in Dse.UI (Angular flat config + projectService), invoked in-package via pnpm filter.
 * C# is formatted by the local CSharpier dotnet tool; everything else by Prettier; spelling by cspell.
 *
 * @type {import('lint-staged').Configuration}
 */
export default {
  'Dse.UI/**/*.{ts,js,html}': ['pnpm --filter dse exec eslint --fix'],
  '*.cs': (files) => `dotnet csharpier format ${files.map((file) => relative(process.cwd(), file)).join(' ')}`,
  '*.{ts,js,html,json,css,scss,md,svg,csproj,esproj}': ['prettier --write'],
  '*.{ts,js,html,md,cs}': ['cspell --quiet --no-must-find-files'],
};
