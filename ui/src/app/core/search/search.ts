import {inject, Service} from '@angular/core';
import {Router} from '@angular/router';
import {injectQueryParams} from 'ngxtension/inject-query-params';

/**
 * The search query lives entirely in the URL (`?q=`) — shareable, deep-linkable, and the single
 * source of truth the search-shell renders from. Writing preserves the path and named outlets,
 * so a query can be set or cleared from anywhere without disturbing where you are.
 */
@Service()
export class Search {
  readonly #router = inject(Router);

  readonly query = injectQueryParams('q');

  set(value: string): void {
    const tree = this.#router.parseUrl(this.#router.url);
    const q = value.trim();
    if (q) tree.queryParams = {...tree.queryParams, q};
    else delete tree.queryParams['q'];
    void this.#router.navigateByUrl(tree);
  }
}
