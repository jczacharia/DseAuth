import {type Source} from '#core/source/source';
import {inject, InjectionToken, Service, type Provider, type Type} from '@angular/core';

const SOURCES = new InjectionToken<Source[]>(ngDevMode ? 'SourceRegistry' : '');

@Service()
export class SourceRegistry {
  static provide(sources: Type<Source>[]): Provider {
    return sources.map((source): Provider => ({provide: SOURCES, useExisting: source, multi: true}));
  }

  readonly sources = inject(SOURCES);
  readonly [Symbol.iterator] = this.sources[Symbol.iterator].bind(this.sources);

  /** Drillable sources — everything except aggregates (e.g. PNC, which is the root). */
  readonly leaves = this.sources.filter((source) => !source.isAggregate);

  readonly #byKey = new Map(this.sources.map((source) => [source.key, source]));

  get(key: string): Source | undefined {
    return this.#byKey.get(key);
  }

  /** Resolve a hit's owning source from its ES `_index` (e.g. `source-confluence-search` → Confluence). */
  sourceForIndex(index: string): Source | undefined {
    const key = /^source-([^-]+)-/.exec(index)?.[1];
    return key ? this.#byKey.get(key) : undefined;
  }
}
