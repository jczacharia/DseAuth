import type {Fn} from '#shared/types';
import {type EffectRef, type Injector} from '@angular/core';
import {setupContext} from '@signality/core/internal';

/**
 * Use when you need a `setTimeout` that auto-clears on injector destroy and can be rescheduled
 * safely, avoiding the leaks and boilerplate of managing raw timer ids inside components.
 */
export class Timeout implements EffectRef {
  #currentId: ReturnType<typeof setTimeout> | null = null;

  protected constructor(injector?: Injector) {
    const {runInContext} = setupContext(injector, new.target.constructor.bind(this) as Fn);
    runInContext(({onCleanup}) => onCleanup(() => this.destroy()));
  }

  /**
   * Use when the handle will be reused over the component's lifetime (e.g. as a debounce slot)
   * and you want to schedule the actual work later via {@link set}.
   */
  static create(injector?: Injector): Timeout {
    return new Timeout(injector);
  }

  /**
   * Use for fire-and-forget delayed work that still needs auto-cancel on destroy; equivalent to
   * {@link create} followed by {@link set}.
   */
  static spawn(delay: number, fn: () => void, injector?: Injector): Timeout {
    const timeout = new Timeout(injector);
    timeout.set(delay, fn);
    return timeout;
  }

  /**
   * Use to (re)schedule the callback — cancels any previously pending invocation so the handle
   * can be safely driven by repeated events like keystrokes.
   */
  set(delay: number, fn: () => void): void {
    this.clear();
    this.#currentId = setTimeout(() => {
      this.#currentId = null;
      fn();
    }, delay);
  }

  /** Use to check whether a scheduled callback is still pending (not yet fired or cancelled). */
  get isSet(): boolean {
    return this.#currentId !== null;
  }

  /** Use to cancel a pending callback without permanently tearing down the handle. */
  clear(): void {
    if (this.#currentId !== null) {
      clearTimeout(this.#currentId);
      this.#currentId = null;
    }
  }

  /**
   * Use when you want to explicitly tear the handle down early; otherwise this runs automatically
   * on injector destroy.
   */
  destroy(): void {
    this.clear();
  }
}
