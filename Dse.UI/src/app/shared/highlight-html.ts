import type {ParsedSearch} from '#shared/parse-search-query';

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

// A global matcher for the parsed query, or null when there's nothing safe to highlight (empty
// query, or an invalid user regex — in which case the content is left untouched rather than throw).
function buildMatcher(parsed: ParsedSearch): RegExp | null {
  try {
    if (parsed.kind === 'regex') {
      if (!parsed.pattern) return null;
      return new RegExp(parsed.pattern, parsed.caseInsensitive ? 'gi' : 'g');
    }
    const terms = parsed.query.split(/\s+/).filter(Boolean).map(escapeRegExp);
    return terms.length ? new RegExp(terms.join('|'), 'gi') : null;
  } catch {
    return null;
  }
}

/**
 * Wrap query matches in `<mark>`, walking text nodes only so tags and attributes are never
 * corrupted (a naive regex replace on the HTML string would mark inside `href`s and split tags).
 * Text already inside a `<mark>` — e.g. an Elasticsearch highlight — is skipped, so this composes
 * with server-side highlights instead of double-wrapping. Browser-only: needs a real DOM.
 *
 * Note for simple (term) mode this marks literal whitespace-split terms, not fuzzy/stem variants —
 * ES does the stemmed marking server-side; this is the best-effort client pass for content ES
 * never highlighted (the expanded body view, and regex results).
 */
export function highlightHtml(html: string, parsed: ParsedSearch, doc: Document): string {
  const re = buildMatcher(parsed);
  if (!re || !html) return html;

  const tpl = doc.createElement('template');
  tpl.innerHTML = html;

  const walker = doc.createTreeWalker(tpl.content, NodeFilter.SHOW_TEXT);
  const targets: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    if (text.data.trim() && text.parentElement?.tagName !== 'MARK') targets.push(text);
  }

  for (const text of targets) {
    const frag = markMatches(text.data, re, doc);
    if (frag) text.replaceWith(frag);
  }
  return tpl.innerHTML;
}

// Build a fragment wrapping each match of `re` in `<mark>`, or null when nothing matched.
function markMatches(data: string, re: RegExp, doc: Document): DocumentFragment | null {
  re.lastIndex = 0;
  if (!re.test(data)) return null;
  re.lastIndex = 0;
  const frag = doc.createDocumentFragment();
  let last = 0;
  for (let m = re.exec(data); m; m = re.exec(data)) {
    if (m.index > last) frag.append(data.slice(last, m.index));
    const mark = doc.createElement('mark');
    mark.textContent = m[0];
    frag.append(mark);
    last = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex++; // never spin on a zero-width match
  }
  if (last < data.length) frag.append(data.slice(last));
  return frag;
}
