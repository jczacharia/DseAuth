import {IdGenerator} from '#shared/id-generator';
import {getOrInsertComputed} from '#shared/map-polyfills';
import {perHost} from '#shared/per-host';
import {isNil} from '#shared/validators';
import {booleanAttribute, HostAttributeToken, inject, Injector, runInInjectionContext} from '@angular/core';

export function softDisabledAttribute(
  value: boolean | '' | 'hard' | 'soft' | 'true' | 'false' | null | undefined,
  defaultValue: boolean | 'soft' = false,
): boolean | 'soft' {
  if (isNil(value)) return defaultValue;
  if (typeof value !== 'string') return booleanAttribute(value);
  const trimmed = value.trim().toLowerCase();
  if (trimmed === 'soft') return 'soft';
  return booleanAttribute(trimmed);
}

export function nonEmptyStringAttribute(v: string | null | undefined): string | null {
  return isNil(v) ? null : String(v).trim() || null;
}

const HostAttr = perHost(() => {
  const cache = new Map<string, string | null>();
  const injector = inject(Injector);
  return (attr: string) =>
    getOrInsertComputed(cache, attr, () =>
      runInInjectionContext(injector, () => inject(new HostAttributeToken(attr), {optional: true})),
    );
});

export function hostAttr(attr: string): string | null {
  return inject(HostAttr)(attr);
}

export const AnchorName = perHost(() => inject(IdGenerator)('--anchor'));
export const ElementId = perHost(() => inject(IdGenerator)('element'));
