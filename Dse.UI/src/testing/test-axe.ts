import axe, {type AxeResults, type RunOptions} from 'axe-core';

/**
 * Default axe config for library primitives.
 *
 * - WCAG 2.1 AA + best-practice rules
 * - `color-contrast` disabled because jsdom has no layout engine so contrast
 *   cannot be computed reliably — contrast lives in E2E / storybook a11y.
 * - `region` disabled because primitives are tested in isolation without a
 *   landmark wrapper.
 */
export const DEFAULT_AXE_OPTIONS: RunOptions = {
  runOnly: {
    type: 'tag',
    values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
  },
  rules: {
    'color-contrast': {enabled: false},
    region: {enabled: false},
  },
};

/** Run axe against a DOM subtree and return the full result. */
export async function runAxe(
  target: Element = document.body,
  options: RunOptions = DEFAULT_AXE_OPTIONS,
): Promise<AxeResults> {
  return axe.run(target, options);
}

/**
 * Assert the DOM subtree has zero axe violations. On failure the error
 * includes every violation's id, description, and failing node selector.
 */
export async function expectNoA11yViolations(
  target: Element = document.body,
  options: RunOptions = DEFAULT_AXE_OPTIONS,
): Promise<void> {
  const results = await runAxe(target, options);
  if (results.violations.length === 0) return;

  const report = results.violations
    .map((v) => {
      const nodes = v.nodes.map((n) => `    - ${n.target.join(' ')}\n      ${n.failureSummary ?? ''}`).join('\n');
      return `  [${v.id}] ${v.help} (${v.impact})\n${nodes}`;
    })
    .join('\n');
  throw new Error(`axe found ${results.violations.length} violation(s):\n${report}`);
}
