import {readdirSync} from 'node:fs';
import {dirname, join, relative} from 'node:path';

/**
 * Root-orchestrated lint-staged. Runs from the repo root (git root).
 * ESLint stays in Dse.UI (Angular flat config + projectService), invoked in-package via pnpm filter.
 * C# is formatted by the local CSharpier dotnet tool; everything else by Prettier; spelling by cspell.
 *
 * @type {import('lint-staged').Configuration}
 */

/** Nearest enclosing .csproj for a file, or null. Roslyn analysis is per-project, so scoping
 *  `dotnet format` to one project loads far less than the whole .slnx (which loads all 7). */
function nearestProject(file) {
  const root = process.cwd();
  for (let dir = dirname(file); ; dir = dirname(dir)) {
    const csproj = readdirSync(dir).find((entry) => entry.endsWith('.csproj'));
    if (csproj) return join(dir, csproj);
    if (dir === root || dirname(dir) === dir) return null;
  }
}

export default {
  'Dse.UI/**/*.{ts,js,html}': ['pnpm --filter dse exec eslint --cache --fix'],
  // C# is two passes: `dotnet format style` is the `eslint --fix` analog (auto-removes unused usings,
  // inserts file headers, fixes accessibility modifiers, modernizes), then CSharpier owns final layout.
  // Scope to a single project when the commit stays within one; fall back to the solution otherwise
  // (N project loads can cost more than one .slnx load). --no-restore: the IDE has already restored.
  '*.cs': (files) => {
    const rel = files.map((file) => relative(process.cwd(), file)).join(' ');
    const projects = new Set(files.map((file) => nearestProject(file)));
    const onlyProject = projects.size === 1 ? [...projects][0] : null;
    const target = onlyProject ? relative(process.cwd(), onlyProject) : 'Dse.slnx';
    return [
      `dotnet format style ${target} --include ${rel} --severity info --verbosity detailed --no-restore`,
      `dotnet csharpier format ${rel}`,
    ];
  },
  '*.{ts,js,html,json,css,scss,md,svg,csproj,esproj}': ['prettier --write'],
};
