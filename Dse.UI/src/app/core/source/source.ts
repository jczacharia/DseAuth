import type {Lazy} from '#shared/lazy';
import {inject, Injectable, type InputSignal, type Signal, type Type} from '@angular/core';
import {isActive, Router} from '@angular/router';
import type {estypes} from '@elastic/elasticsearch';

const SOURCE_BRAND = Symbol(ngDevMode ? 'SOURCE_BRAND' : undefined);

export interface SearchCard<Doc = unknown> {
  readonly hit: InputSignal<estypes.SearchHit<Doc>>;
}

export interface SourceOptions<Doc = unknown> {
  readonly name: string;
  readonly summary: string;
  readonly description: string;
  readonly icon: string;
  readonly color: string;

  readonly card?: Lazy<Promise<Type<SearchCard<Doc>>>>;
  readonly sidebar?: Lazy<Type<unknown>>;
  readonly landing?: Lazy<Type<unknown>>;

  readonly members?: readonly string[];
}

@Injectable()
export abstract class Source {
  declare private readonly [SOURCE_BRAND]: true;
  readonly isActive: Signal<boolean>;

  get isAggregate() {
    return this.options.members !== undefined;
  }

  get readTarget() {
    return this.isAggregate ? 'source-*-search' : `source-${this.key}-search`;
  }

  get searchPath() {
    return `api/sources/${this.key}/search`;
  }

  constructor(
    readonly key: string,
    readonly options: SourceOptions,
  ) {
    Object.defineProperty(this, SOURCE_BRAND, {value: true});
    this.isActive = isActive(`/${this.key}`, inject(Router), {
      paths: 'subset',
      fragment: 'ignored',
      matrixParams: 'ignored',
      queryParams: 'ignored',
    });
  }
}

export function isSource(value: unknown): value is Source {
  return typeof value === 'object' && value !== null && SOURCE_BRAND in value;
}

export type SourceKey<S extends Source> = S extends Source ? S['key'] : never;
