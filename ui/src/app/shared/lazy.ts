import {inject, Injector, runInInjectionContext} from '@angular/core';

/**
 * Lazily computes and caches a value on first access.
 */
export class Lazy<TValue> {
  #cached?: TValue;
  #computed = false;
  readonly #injector = inject(Injector);

  constructor(private readonly factory: () => TValue) {}

  get value(): TValue {
    if (!this.#computed) {
      this.#cached = runInInjectionContext(this.#injector, this.factory);
      this.#computed = true;
    }
    return this.#cached!;
  }
}
