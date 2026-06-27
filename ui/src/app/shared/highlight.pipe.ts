import {highlightHtml} from '#shared/highlight-html';
import {parseSearchQuery} from '#shared/parse-search-query';
import {DOCUMENT, isPlatformServer} from '@angular/common';
import {inject, Pipe, PLATFORM_ID, type PipeTransform} from '@angular/core';

/**
 * `text | highlight: query | sanitizeHtml` — wraps query matches in `<mark>` client-side, for
 * content Elasticsearch didn't highlight (the expanded body view, regex results). Pure: only
 * recomputes when `html` or `query` change. No-op on the server (highlighting needs a live DOM).
 */
@Pipe({name: 'highlight'})
export class HighlightPipe implements PipeTransform {
  readonly #doc = inject(DOCUMENT);
  readonly #isServer = isPlatformServer(inject(PLATFORM_ID));

  transform(html: string | string[] | null | undefined, query: string | null | undefined): string {
    if (!html) return '';
    // ES highlight fields arrive as string[] (fragments); collapse like SanitizeHtmlPipe does.
    const text = Array.isArray(html) ? html.join() : html;
    if (!query || this.#isServer) return text;
    return highlightHtml(text, parseSearchQuery(query), this.#doc);
  }
}
