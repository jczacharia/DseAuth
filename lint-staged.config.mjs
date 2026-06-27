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
  // C# is two passes: `dotnet format style` is the `eslint --fix` analog (auto-removes unused usings,
  // inserts file headers, fixes accessibility modifiers, modernizes), then CSharpier owns final layout.
  '*.cs': (files) => {
    const list = files.map((file) => relative(process.cwd(), file)).join(' ');
    return [
      `dotnet format style Dse.slnx --include ${list} --severity info --verbosity detailed`,
      `dotnet csharpier format ${list}`,
    ];
  },
  '*.{ts,js,html,json,css,scss,md,svg,csproj,esproj}': ['prettier --write'],
};
