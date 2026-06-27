import {ElementRef, inject} from '@angular/core';

/**
 * Use inside a directive/component factory when you need the host `ElementRef` and want a typed
 * generic without repeating `inject(ElementRef<T>)` boilerplate.
 */
export function injectElementRef<T = HTMLElement>(): ElementRef<T> {
  return inject<ElementRef<T>>(ElementRef);
}

/**
 * Use when you only want the native host element and not the `ElementRef` wrapper (e.g. for DOM
 * reads, attribute access, or event wiring).
 */
export function injectElement<T = HTMLElement>(): T {
  return injectElementRef<T>().nativeElement;
}
