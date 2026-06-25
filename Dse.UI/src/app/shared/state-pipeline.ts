import {
  computed,
  isSignal,
  linkedSignal,
  signal,
  type CreateComputedOptions,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import {deepComputed, type DeepSignal} from '@ngrx/signals';
import type {WithInjector} from '@signality/core';
import {setupContext} from '@signality/core/internal';

/**
 * Use inside a {@link StatePipelineHandler} to read the current state, pass a (possibly
 * transformed) value to `next()`, or halt further transformation.
 */
export interface StatePipelineContext<T> {
  get state(): T;
  next(override?: T): T;
  halted(): boolean;
  halt(): void;
}

/**
 * Use when declaring a transformer for {@link StatePipeline.intercept}; each handler returns the
 * next value in the chain (typically the result of `ctx.next()`).
 */
export type StatePipelineHandler<T> = (ctx: StatePipelineContext<T>) => T;

/**
 * Use when constructing a {@link StatePipeline} and you need to customize the underlying
 * `computed` options or run a final `finalize` transform after all interceptors.
 */
export interface StatePipelineOptions<T> extends CreateComputedOptions<T> {
  readonly finalize?: (value: T) => T;
}

/**
 * Use when registering a transformer with priority control or opting out of the auto-cleanup
 * bound to the current injection context.
 */
export interface StatePipelineInterceptOptions extends WithInjector {
  readonly manualCleanup?: boolean;
  readonly priority?: number;
}

interface Methods<T> {
  readonly size: Signal<number>;
  intercept(handler: StatePipelineHandler<T>, opts?: StatePipelineInterceptOptions): () => void;
  set(value: T): void;
  update(updater: (value: T) => T): void;
}

/**
 * Use when you need a writable signal whose emitted value is computed by running the current
 * value through a prioritized chain of interceptors that features can register into.
 */
export interface StatePipeline<T> extends Signal<T>, Methods<T> {
  asReadonly(): Signal<T>;
}

/**
 * Use when the underlying state is an object and consumers want `DeepSignal`-style nested access
 * on top of the pipeline's intercept/set/update surface.
 */
export type PipelineDeepSignal<T extends object> = DeepSignal<T> & Methods<T> & {asReadonly(): DeepSignal<T>};

/**
 * Use as the callable signature of {@link statePipeline}: invoke directly for a flat pipeline, or
 * call `.deep()` for a nested deep-signal pipeline.
 */
export interface StatePipelineFunction {
  <T>(source: T | Signal<T>, opts?: StatePipelineOptions<T>): StatePipeline<T>;
  deep<T extends object>(source: T | Signal<T>, opts?: StatePipelineOptions<NoInfer<T>>): PipelineDeepSignal<T>;
}

interface Registration<T> {
  readonly priority: number;
  readonly handler: StatePipelineHandler<T>;
}

// Module-scoped so the remover closure stays within the function-nesting budget.
const removeHandler =
  <T>(state: WritableSignal<Registration<T>[]>, handler: StatePipelineHandler<T>) =>
  () =>
    state.update((h) => h.filter((x) => x.handler !== handler));

function createPipeline<T>(
  source: T | Signal<T>,
  options?: StatePipelineOptions<NoInfer<T>>,
): Methods<T> & {result: Signal<T>} {
  const link = isSignal(source) ? linkedSignal(source) : signal(source);
  const finalize = options?.finalize ?? ((value: T) => value);

  const state = signal<Registration<T>[]>([]);

  function intercept(handler: StatePipelineHandler<T>, opts?: StatePipelineInterceptOptions): () => void {
    state.update((h) => [{priority: opts?.priority ?? 0, handler}, ...h]);
    const rm = removeHandler(state, handler);
    if (opts?.manualCleanup) return rm;
    const {runInContext} = setupContext(opts?.injector, intercept);
    return runInContext(({onCleanup}) => {
      onCleanup(rm);
      return rm;
    });
  }

  const handlers = computed(() => [...state()].sort((a, b) => b.priority - a.priority).map((x) => x.handler));

  return {
    result: computed(() => finalize(executePipeline(handlers(), link())), options),
    size: computed(() => handlers().length),
    intercept: (handler, opts) => intercept(handler, opts),
    set: (value) => link.set(value),
    update: (updater) => link.update(updater),
  };
}

function executePipeline<T>(handlers: StatePipelineHandler<T>[], state: T): T {
  let halted = false;

  const execute = (index: number, state: T): T => {
    if (halted || index >= handlers.length) return state;
    return (
      handlers[index]?.({
        get state(): T {
          return state;
        },
        next: (override?: T) => execute(index + 1, override ?? state),
        halted: () => halted,
        halt() {
          halted = true;
        },
      }) ?? state
    );
  };

  return execute(0, state);
}

/**
 * Use when a piece of state should be derivable through a cooperative chain of transformations
 * (e.g. base value -> normalization -> feature overlays -> finalize) instead of a single reducer.
 */
export const statePipeline: StatePipelineFunction = Object.assign(
  function <T>(source: T | Signal<T>, opts?: StatePipelineOptions<T>): StatePipeline<T> {
    const {result, size, intercept, set, update} = createPipeline(source, opts);
    const readOnly = computed(() => result());
    return Object.assign(result, {
      intercept,
      set,
      update,
      asReadonly: () => readOnly,
      size,
    });
  },
  {
    deep<T extends object>(source: T | Signal<T>, opts?: StatePipelineOptions<T>): PipelineDeepSignal<T> {
      const {result, size, intercept, set, update} = createPipeline(source, opts);
      const readOnly = deepComputed(result);
      return Object.assign(deepComputed(result), {
        intercept,
        set,
        update,
        asReadonly: () => readOnly,
        size,
      });
    },
  },
);
