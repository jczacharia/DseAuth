import {signal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {statePipeline} from './state-pipeline';

describe('statePipeline', () => {
  describe('source tracking', () => {
    it('reflects a raw source value', () => {
      TestBed.runInInjectionContext(() => {
        const p = statePipeline(5);
        expect(p()).toBe(5);
      });
    });

    it('tracks an upstream signal', () => {
      TestBed.runInInjectionContext(() => {
        const src = signal(1);
        const p = statePipeline(src);
        expect(p()).toBe(1);
        src.set(10);
        expect(p()).toBe(10);
      });
    });

    it('set() overrides the source', () => {
      TestBed.runInInjectionContext(() => {
        const p = statePipeline(1);
        p.set(42);
        expect(p()).toBe(42);
      });
    });

    it('update() transforms the source', () => {
      TestBed.runInInjectionContext(() => {
        const p = statePipeline(1);
        p.update((v) => v + 10);
        expect(p()).toBe(11);
      });
    });

    it('next() gives original state', () => {
      TestBed.runInInjectionContext(() => {
        const p = statePipeline(1);
        p.intercept(({next}) => {
          const v = next();
          expect(v).toBe(1);
          return v + 10;
        });
        expect(p()).toBe(11);
      });
    });
  });

  describe('execution order', () => {
    it('runs handlers in LIFO (last intercepted runs first)', () => {
      TestBed.runInInjectionContext(() => {
        const order: string[] = [];
        const p = statePipeline(0);
        p.intercept(({next}) => {
          order.push('a');
          return next();
        });
        p.intercept(({next}) => {
          order.push('b');
          return next();
        });
        p.intercept(({next}) => {
          order.push('c');
          return next();
        });
        p();
        expect(order).toEqual(['c', 'b', 'a']);
      });
    });
  });

  describe('next()', () => {
    it('returning without calling next short-circuits the chain', () => {
      TestBed.runInInjectionContext(() => {
        const inner = vi.fn(() => 99);
        const p = statePipeline(0);
        p.intercept(inner);
        p.intercept(() => 42);
        expect(p()).toBe(42);
        expect(inner).not.toHaveBeenCalled();
      });
    });
  });

  describe('halt', () => {
    it('stops delegation and returns the halting handler value', () => {
      TestBed.runInInjectionContext(() => {
        const inner = vi.fn(({next}: {next: () => number}) => next());
        const p = statePipeline(0);
        p.intercept(inner);
        p.intercept(({halt}) => {
          halt();
          return 7;
        });
        expect(p()).toBe(7);
        expect(inner).not.toHaveBeenCalled();
      });
    });

    it('halted() flips to true once halt() is called', () => {
      TestBed.runInInjectionContext(() => {
        const p = statePipeline(0);
        let before: boolean | undefined;
        let after: boolean | undefined;
        p.intercept(({halted, halt}) => {
          before = halted();
          halt();
          after = halted();
          return 0;
        });
        p();
        expect(before).toBe(false);
        expect(after).toBe(true);
      });
    });
  });

  describe('finalize', () => {
    it('runs after the chain on every emission', () => {
      TestBed.runInInjectionContext(() => {
        const p = statePipeline(5, {finalize: (v) => v * 2});
        expect(p()).toBe(10);
        p.set(3);
        expect(p()).toBe(6);
      });
    });

    it('runs even when the chain is halted', () => {
      TestBed.runInInjectionContext(() => {
        const p = statePipeline(0, {finalize: (v) => v + 100});
        p.intercept(({halt}) => {
          halt();
          return 1;
        });
        expect(p()).toBe(101);
      });
    });
  });

  describe('intercept cleanup', () => {
    it('returned function removes the handler', () => {
      TestBed.runInInjectionContext(() => {
        const p = statePipeline(0);
        const remove = p.intercept(() => 42);
        expect(p()).toBe(42);
        remove();
        expect(p()).toBe(0);
      });
    });
  });

  describe('asReadonly', () => {
    it('exposes a read-only signal view that tracks the pipeline', () => {
      TestBed.runInInjectionContext(() => {
        const p = statePipeline(5);
        const ro = p.asReadonly();
        expect(ro()).toBe(5);
        p.set(10);
        expect(ro()).toBe(10);
      });
    });

    it('does not expose mutator methods', () => {
      TestBed.runInInjectionContext(() => {
        const ro = statePipeline(5).asReadonly();
        expect('set' in ro).toBe(false);
        expect('intercept' in ro).toBe(false);
        expect('override' in ro).toBe(false);
      });
    });
  });

  describe('statePipeline.deep', () => {
    it('reads fields on the resulting DeepSignal', () => {
      TestBed.runInInjectionContext(() => {
        const p = statePipeline.deep({count: 1, name: 'x'});
        expect(p.count()).toBe(1);
        expect(p.name()).toBe('x');
      });
    });

    it('set() replaces the source object', () => {
      TestBed.runInInjectionContext(() => {
        const p = statePipeline.deep({count: 1});
        p.set({count: 50});
        expect(p.count()).toBe(50);
      });
    });
  });
});
