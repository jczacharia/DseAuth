import {Source} from '#core/source/source';
import {mergeEsQuery} from '#shared/merge-es-query';
import {statePipeline} from '#shared/state-pipeline';
import {DOCUMENT, inject, Injectable, signal} from '@angular/core';
import type {estypes} from '@elastic/elasticsearch';
import {listener, setupSync} from '@signality/core';
import type * as z from 'zod';

@Injectable()
export abstract class SourceClient {
  readonly #source = inject(Source);

  constructor() {
    setupSync(() => {
      listener(inject(DOCUMENT), 'keydown', (event) => {
        if (event.altKey && event.key.toLowerCase() === 'c') {
          this.clearCache();
          console.debug(`[SourceClient] Query cache cleared via Alt+C for source ${this.#source.key}`);
        }
      });
    });
  }

  readonly request = statePipeline(signal<estypes.SearchRequest>({}), {
    finalize: (value) => mergeEsQuery(value, {size: 20}),
  });

  abstract schema: z.ZodType<object>;

  abstract simpleQueryString(query: string): estypes.SearchRequest;
  abstract regex(query: string, caseInsensitive: boolean): estypes.SearchRequest | null;
  defaultSearch(): estypes.SearchRequest | null {
    return null;
  }

  clearCache() {
    // TODO
  }
}
