/** Use when branching on "value is missing" semantics and you want both `null` and `undefined` treated alike. */
export function isNil(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * Use as a `.filter()` predicate to narrow `(T | null | undefined)[]` to `T[]` in a single pass
 * without manual casts.
 */
export function notNil<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/** Use when a {@link MaybeFn}-style value must be branched on "is this a factory or a literal". */
export function isFunction(value: unknown): value is CallableFunction {
  return typeof value === 'function';
}

/**
 * Use at a call site to both require and narrow a nullable value in one step, instead of the
 * boilerplate `if (!x) throw` pattern.
 */
export function assertNotNil<T>(
  value: T | null | undefined,
  message = 'Expected value to be defined',
): asserts value is T {
  if (value === null || value === undefined) {
    throw new TypeError(message);
  }
}

/**
 * Use when validating user-provided or attribute-sourced strings where whitespace-only values
 * should count as empty via the `trim` option.
 */
export function isNonEmptyString(value: unknown, {trim = false}: {trim?: boolean} = {}): value is string {
  if (typeof value !== 'string') return false;
  return (trim ? value.trim() : value).length > 0;
}

/**
 * Use when you need to guarantee an array has at least one element before safely indexing `[0]`
 * or destructuring a head.
 */
export function isNonEmptyArray<T>(value: readonly T[] | null | undefined): value is readonly [T, ...T[]] {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Type guard for plain object literals — those with `Object.prototype` or a `null` prototype.
 * Excludes arrays, class instances, `Map`, `Set`, `Date`, `Promise`, `RegExp`, etc.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || typeof value?.[Symbol.iterator as never] === 'function') {
    return false;
  }
  const proto = Object.getPrototypeOf(value) as object | null;
  return proto === null || proto === Object.prototype;
}
