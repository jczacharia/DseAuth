import type {estypes} from '@elastic/elasticsearch';

type Plain = Record<string, unknown>;

export type DeepPartial<T> = T extends (infer U)[]
  ? DeepPartial<U>[]
  : T extends object
    ? {[K in keyof T]?: DeepPartial<T[K]>}
    : T;

/**
 * Array-valued keys whose contents accumulate across merges.
 * Suffix-matched: `must` covers `query.bool.must` and any nested bool.
 */
const CONCAT_KEYS = new Set([
  'must',
  'should',
  'must_not',
  'filter',
  'functions',
  'rescore',
  'sort',
  'includes',
  'excludes',
  'fields',
  'docvalue_fields',
  'stored_fields',
]);

/** `_source.includes`/`excludes` carry field paths; concat-with-dedup. */
const DEDUP_CONCAT_KEYS = new Set(['includes', 'excludes']);

/**
 * Object-valued keys that are atoms — replacing two unrelated definitions
 * with a deep-merge produces invalid DSL.
 */
const REPLACE_KEYS = new Set([
  'script',
  'script_score',
  'range',
  'geo_distance',
  'geo_bounding_box',
  'geo_polygon',
  'geo_shape',
  'shape',
]);

/**
 * Parent keys whose immediate children are independent named entries that
 * should override wholesale. Two definitions of the same agg name = the
 * later one wins; merging their bodies produces a chimera.
 */
const NAMED_CHILDREN_PARENTS = new Set(['aggs', 'aggregations']);

const isPlainObject = (v: unknown): v is Plain =>
  v !== null &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);

const cloneDeep = <T>(v: T): T => (v === null || typeof v !== 'object' ? v : structuredClone(v));

/**
 * Deep-merges two Elasticsearch DSL fragments with ES-aware semantics.
 *
 * - Bool clauses (`must`/`should`/`must_not`/`filter`), `functions`,
 *   `rescore`, `sort`, `fields`, `docvalue_fields`, `stored_fields`
 *   concatenate. `_source.includes`/`excludes` concat with dedup.
 * - Single-slot query containers (`query`, `script`, `range`, geo shapes)
 *   replace wholesale.
 * - `aggs`/`aggregations` merge by key, but each named agg replaces wholesale.
 * - Bool clauses normalize the `QueryContainer | QueryContainer[]` overload
 *   to arrays before concatenating.
 * - `undefined` on the override side is "no opinion" — left wins.
 *   `null` is an explicit clear and clobbers.
 *
 * @example
 * mergeEsQuery(base, { query: { bool: { filter: [{ term: { tenantId: 'x' } }] } } })
 */
export function mergeEsQuery<T extends estypes.SearchRequest>(base: T, override: DeepPartial<NoInfer<T>>): T {
  const val = mergeNode(base, override, '', '') as T;
  if (!Object.keys(val.query ?? {}).length) delete val.query;
  return val;
}

function mergeNode(left: unknown, right: unknown, key: string, parentKey: string): unknown {
  if (right === undefined) return cloneDeep(left);
  if (right === null) return null;

  if (NAMED_CHILDREN_PARENTS.has(parentKey)) return cloneDeep(right);
  if (REPLACE_KEYS.has(key)) return cloneDeep(right);

  // QueryContainer slot: a valid container has exactly one top-level key
  // (`match`, `term`, `bool`, ...). When both sides agree on that key, we
  // recurse so `bool.must` etc. can compose. When they disagree, right wins
  // wholesale to prevent chimeras like `{ match: {...}, term: {...} }`.
  if (key === 'query' && isPlainObject(left) && isPlainObject(right) && !sameSingleKey(left, right)) {
    return cloneDeep(right);
  }

  const leftIsArray = Array.isArray(left);
  const rightIsArray = Array.isArray(right);

  if (CONCAT_KEYS.has(key) && (leftIsArray || rightIsArray)) {
    return concatClauses(left, right, key, leftIsArray, rightIsArray);
  }

  // A type mismatch (array vs non-array) or two arrays outside a concat key: right wins wholesale.
  if (leftIsArray || rightIsArray) return cloneDeep(right);

  if (isPlainObject(left) && isPlainObject(right)) return mergeObjects(left, right, key);

  return cloneDeep(right);
}

/** Both sides are single-key containers naming the same clause (e.g. both `{ bool: ... }`). */
function sameSingleKey(left: Plain, right: Plain): boolean {
  const lk = Object.keys(left);
  const rk = Object.keys(right);
  return lk.length === 1 && rk.length === 1 && lk[0] === rk[0];
}

/** Concatenate clause arrays, normalizing the `Container | Container[]` overload and deduping field-path keys. */
function concatClauses(
  left: unknown,
  right: unknown,
  key: string,
  leftIsArray: boolean,
  rightIsArray: boolean,
): unknown {
  let leftArr: unknown[];
  if (leftIsArray) leftArr = left as unknown[];
  else if (left === undefined) leftArr = [];
  else leftArr = [left];
  const rightArr = rightIsArray ? (right as unknown[]) : [right];
  const merged = [...cloneDeep(leftArr), ...cloneDeep(rightArr)];
  if (DEDUP_CONCAT_KEYS.has(key)) return Array.from(new Set(merged as (string | number)[]));
  return merged;
}

/** Key-wise deep merge of two plain objects; left's keys seed the result, right's keys recurse. */
function mergeObjects(left: Plain, right: Plain, key: string): Plain {
  const out: Plain = {};
  for (const k of Object.keys(left)) out[k] = cloneDeep(left[k]);
  for (const k of Object.keys(right)) out[k] = mergeNode(left[k], right[k], k, key);
  return out;
}
