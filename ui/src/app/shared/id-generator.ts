import {InjectionToken} from '@angular/core';

/**
 * Use when you need a deterministic, app-wide source of unique ids for ARIA wiring or DOM
 * identity; inject it at the root so the same counters are shared across the whole application.
 */
export const IdGenerator = new InjectionToken(ngDevMode ? 'IdGenerator' : '', {
  factory: () => {
    const map = new Map<string, number>();
    function generate(): `dse-${number}`;
    function generate(prefix?: ''): `dse-${number}`;
    function generate<const P extends string>(prefix: P): `${P}-${number}`;
    function generate<const P extends string>(prefix?: P) {
      prefix = (prefix?.trim() || 'dse') as P;
      const id = (map.get(prefix) ?? 0) + 1;
      map.set(prefix, id);
      return `${prefix}-${id}` as const;
    }
    return generate;
  },
});
