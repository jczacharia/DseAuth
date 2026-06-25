import {computed, signal, type Signal, type WritableSignal} from '@angular/core';
import type {WithInjector} from '@signality/core';
import {setupContext} from '@signality/core/internal';

/**
 * Use inside an {@link EventPipelineHandler} to read the event, decide whether to halt the
 * chain, or continue to the next handler in priority order.
 */
export interface EventPipelineContext<E> {
  get event(): E;
  next(): void;
  halted(): boolean;
  halt(): void;
}

/**
 * Use when declaring a handler for {@link EventPipeline.intercept}; the handler must explicitly
 * call `next()` to pass control along or `halt()` to short-circuit.
 */
export type EventPipelineHandler<E> = (ctx: EventPipelineContext<E>) => void;

/**
 * Use when registering a handler and you need to control its priority order or manage cleanup
 * outside of the current injection context.
 */
export interface EventPipelineInterceptOptions extends WithInjector {
  readonly manualCleanup?: boolean;
  readonly priority?: number;
}

/**
 * Use when exposing a prioritized interceptor chain for a single event type (e.g. a key or
 * pointer event) that multiple features can hook into cooperatively.
 */
export interface EventPipeline<E> {
  readonly size: Signal<number>;
  intercept(handler: EventPipelineHandler<E>, opts?: EventPipelineInterceptOptions): () => void;
  dispatch(event: E): void;
}

/**
 * Use when building a new {@link EventPipeline} instance for a given event shape; callers wire
 * the transport (listener, doc event, etc.) by invoking the returned `dispatch`.
 */
interface Registration<E> {
  readonly priority: number;
  readonly handler: EventPipelineHandler<E>;
}

// Module-scoped so the remover closure stays within the function-nesting budget.
const removeHandler =
  <E>(state: WritableSignal<Registration<E>[]>, handler: EventPipelineHandler<E>) =>
  () =>
    state.update((h) => h.filter((x) => x.handler !== handler));

export function eventPipeline<E>(): EventPipeline<E> {
  const state = signal<Registration<E>[]>([]);

  function intercept(handler: EventPipelineHandler<E>, opts?: EventPipelineInterceptOptions): () => void {
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
  const size = computed(() => handlers().length);

  const dispatch = (event: E): void => {
    const list = handlers();
    if (list.length === 0) return;
    execute(list, event);
  };

  return {size, intercept, dispatch};
}

function execute<E>(handlers: EventPipelineHandler<E>[], event: E): void {
  let halted = false;

  const run = (index: number): void => {
    if (halted || index >= handlers.length) return;
    handlers[index]?.({
      get event() {
        return event;
      },
      halted: () => halted,
      halt: () => {
        halted = true;
      },
      next: () => {
        if (!halted) run(index + 1);
      },
    });
  };

  run(0);
}
