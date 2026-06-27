export type ParsedSearch =
  | {readonly kind: 'regex'; readonly pattern: string; readonly caseInsensitive: boolean}
  | {readonly kind: 'simple'; readonly query: string};

/**
 * The query string is its own mode signal — no separate toggle or param. `/pattern/` is a regex,
 * `/pattern/i` a case-insensitive one; anything else (or an unterminated `/…`) is a plain term
 * query. Shared by the search dispatch and the client-side highlighter so the two never disagree.
 */
export function parseSearchQuery(raw: string): ParsedSearch {
  const q = raw.trim();
  if (q.length >= 2 && q.startsWith('/')) {
    const caseInsensitive = q.endsWith('/i');
    let close = -1;
    if (caseInsensitive) close = q.length - 2;
    else if (q.endsWith('/')) close = q.length - 1;
    if (close > 1) return {kind: 'regex', pattern: q.slice(1, close), caseInsensitive};
  }
  return {kind: 'simple', query: q};
}
