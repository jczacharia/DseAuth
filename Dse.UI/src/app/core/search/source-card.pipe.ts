import {type SearchCard} from '#core/source/source';
import {SourceRegistry} from '#core/source/source-registry';
import {inject, Pipe, type PipeTransform, type Type} from '@angular/core';
import type {estypes} from '@elastic/elasticsearch';

/**
 * Resolves the card component for a hit from its owning source (`_index` → source → `card`), lazily
 * loaded and cached per source. This is the one dispatch that makes heterogeneous results work: a
 * single source renders one card type, the PNC aggregate renders each hit with its source's card.
 */
@Pipe({name: 'sourceCard'})
export class SourceCardPipe implements PipeTransform {
  readonly #registry = inject(SourceRegistry);
  readonly #cache = new Map<string, Promise<Type<SearchCard>> | null>();

  transform(hit: estypes.SearchHit): Promise<Type<SearchCard>> | null {
    const source = this.#registry.sourceForIndex(hit._index ?? '');
    if (!source) return null;
    if (!this.#cache.has(source.key)) {
      this.#cache.set(source.key, source.options.card?.value ?? null);
    }
    return this.#cache.get(source.key) ?? null;
  }
}
