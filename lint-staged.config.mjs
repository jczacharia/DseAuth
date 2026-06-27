import {readdirSync} from 'node:fs';
import {dirname, join, relative} from 'node:path';

/**
 * Root-orchestrated lint-staged. Runs from the repo root (git root).
 * ESLint stays in ui (Angular flat config + projectService), invoked in-package via pnpm filter.
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
  'ui/**/*.{ts,js,html}': ['pnpm --filter dse exec eslint --cache --fix'],
  // C# is two passes: `dotnet format style` is the `eslint --fix` analog (auto-removes unused usings,
  // inserts file headers, fixes accessibility modifiers, modernizes), then CSharpier owns final layout.
  // Scope to a single project when the commit stays within one; fall back to the solution otherwise
  // (N project loads can cost more than one .slnx load). --no-restore: the IDE has already restored.
  '*.cs': (files) => {
    const rel = (list) => list.map((file) => relative(process.cwd(), file)).join(' ');
    // File-based apps under scripts/ belong to no project; dotnet format needs a project/solution, so
    // it only handles project files. CSharpier is path-based and formats everything.
    const inProject = files.filter((file) => nearestProject(file));
    const cmds = [];
    if (inProject.length) {
      const projects = new Set(inProject.map((file) => nearestProject(file)));
      const onlyProject = projects.size === 1 ? [...projects][0] : null;
      const target = onlyProject ? relative(process.cwd(), onlyProject) : 'Dse.slnx';
      cmds.push(
        `dotnet format style ${target} --include ${rel(inProject)} --severity info --verbosity detailed --no-restore`,
      );
    }
    cmds.push(`dotnet csharpier format ${rel(files)}`);
    return cmds;
  },
  '*.{ts,js,html,json,css,scss,md,svg,csproj,esproj}': ['prettier --write'],
};
