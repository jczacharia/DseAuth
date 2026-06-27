import {parseSearchQuery} from '#shared/parse-search-query';
import type {estypes} from '@elastic/elasticsearch';

const SIZE = 25;

/**
 * Build the Elasticsearch request body for a raw query string. `simple_query_string` searches every
 * mapped text field across the target index(es), so the same body works for a single source and for
 * the PNC aggregate (which fans out over `source-*-search`). Regex mode is a later slice — for now
 * its pattern is searched as a plain term so the happy path holds.
 */
export function buildSearchBody(raw: string): estypes.SearchRequest {
  const parsed = parseSearchQuery(raw);
  const query = parsed.kind === 'simple' ? parsed.query : parsed.pattern;
  return {
    size: SIZE,
    query: {simple_query_string: {query, default_operator: 'and'}},
  };
}
