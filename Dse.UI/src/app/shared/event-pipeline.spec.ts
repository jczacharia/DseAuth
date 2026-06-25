import {Directive, ElementRef, inject, signal} from '@angular/core';
import {render, screen} from '@testing-library/angular';
import {eventPipeline} from './event-pipeline';

// ---------------------------------------------------------------------------
// Test atoms — mirror the shape of OnKeyDown / OnKeyUp in events/.
// Each holds one `eventPipeline<E>()` and re-exposes its methods so host
// bindings and consumers can reach them directly.
// ---------------------------------------------------------------------------

@Directive({host: {'(keydown)': 'dispatch($event)'}})
class TestOnKeyDown {
  readonly #pipeline = eventPipeline<KeyboardEvent>();
  readonly size = this.#pipeline.size;
  readonly intercept = this.#pipeline.intercept;
  readonly dispatch = this.#pipeline.dispatch;
}

@Directive({host: {'(keyup)': 'dispatch($event)'}})
class TestOnKeyUp {
  readonly #pipeline = eventPipeline<KeyboardEvent>();
  readonly size = this.#pipeline.size;
  readonly intercept = this.#pipeline.intercept;
  readonly dispatch = this.#pipeline.dispatch;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function keyDown(el: HTMLElement, key: string, opts?: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {key, bubbles: true, cancelable: true, ...opts});
  el.dispatchEvent(event);
  return event;
}

function keyUp(el: HTMLElement, key: string, opts?: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keyup', {key, bubbles: true, cancelable: true, ...opts});
  el.dispatchEvent(event);
  return event;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('eventPipeline', () => {
  describe('dispatch and handler execution', () => {
    it('dispatches events to a registered handler', async () => {
      const spy = vi.fn();

      @Directive({selector: '[test]', hostDirectives: [TestOnKeyDown]})
      class Host {
        constructor() {
          inject(TestOnKeyDown).intercept(({event}) => spy(event.key));
        }
      }

      await render(`<button test>Click</button>`, {imports: [Host]});
      keyDown(screen.getByRole('button'), 'Enter');
      expect(spy).toHaveBeenCalledWith('Enter');
    });

    it('does nothing when no handlers are registered', async () => {
      @Directive({selector: '[test]', hostDirectives: [TestOnKeyDown]})
      class Host {}

      await render(`<button test>Click</button>`, {imports: [Host]});
      expect(() => keyDown(screen.getByRole('button'), 'Enter')).not.toThrow();
    });

    it('last intercepted handler runs first (LIFO)', async () => {
      const order: string[] = [];

      @Directive({selector: '[test]', hostDirectives: [TestOnKeyDown]})
      class Host {
        constructor() {
          const pipeline = inject(TestOnKeyDown);
          pipeline.intercept(({next}) => {
            order.push('first-registered');
            next();
          });
          pipeline.intercept(({next}) => {
            order.push('second-registered');
            next();
          });
        }
      }

      await render(`<button test>Click</button>`, {imports: [Host]});
      keyDown(screen.getByRole('button'), 'a');
      expect(order).toEqual(['second-registered', 'first-registered']);
    });
  });

  describe('next()', () => {
    it('swallowing the event (no next() call) prevents inner handlers from running', async () => {
      const innerRan = vi.fn();

      @Directive({selector: '[test]', hostDirectives: [TestOnKeyDown]})
      class Host {
        constructor() {
          const pipeline = inject(TestOnKeyDown);
          pipeline.intercept(() => innerRan()); // registered first → runs last (inner)
          pipeline.intercept(() => void 0); // registered last → runs first, does not next()
        }
      }

      await render(`<button test>Click</button>`, {imports: [Host]});
      keyDown(screen.getByRole('button'), 'Enter');
      expect(innerRan).not.toHaveBeenCalled();
    });

    it('next() delegates to the inner (earlier-registered) handler', async () => {
      const innerSpy = vi.fn();

      @Directive({selector: '[test]', hostDirectives: [TestOnKeyDown]})
      class Host {
        constructor() {
          const pipeline = inject(TestOnKeyDown);
          pipeline.intercept(({event}) => innerSpy(event.key)); // inner
          pipeline.intercept(({next}) => next()); // outer delegates
        }
      }

      await render(`<button test>Click</button>`, {imports: [Host]});
      keyDown(screen.getByRole('button'), 'Tab');
      expect(innerSpy).toHaveBeenCalledWith('Tab');
    });

    it('FIFO', async () => {
      const innerRan1 = vi.fn();
      const innerRan2 = vi.fn();

      @Directive({selector: '[test]', hostDirectives: [TestOnKeyDown]})
      class Host {
        constructor() {
          const pipeline = inject(TestOnKeyDown);
          pipeline.intercept(() => innerRan2());
          pipeline.intercept(() => void 0, {priority: 10});
          pipeline.intercept(() => innerRan1());
        }
      }

      await render(`<button test>Click</button>`, {imports: [Host]});
      keyDown(screen.getByRole('button'), 'Enter');
      expect(innerRan1).not.toHaveBeenCalled();
      expect(innerRan2).not.toHaveBeenCalled();
    });
  });

  describe('halt()', () => {
    it('halts before inner handlers run', async () => {
      const innerRan = vi.fn();

      @Directive({selector: '[test]', hostDirectives: [TestOnKeyDown]})
      class Host {
        constructor() {
          const pipeline = inject(TestOnKeyDown);
          pipeline.intercept(() => innerRan()); // inner
          pipeline.intercept(({halt}) => halt()); // outer halts before next()
        }
      }

      await render(`<button test>Click</button>`, {imports: [Host]});
      keyDown(screen.getByRole('button'), 'Enter');
      expect(innerRan).not.toHaveBeenCalled();
    });

    it('halt() after next() has no effect on the already-run chain', async () => {
      const order: string[] = [];

      @Directive({selector: '[test]', hostDirectives: [TestOnKeyDown]})
      class Host {
        constructor() {
          const pipeline = inject(TestOnKeyDown);
          pipeline.intercept(() => order.push('A')); // innermost
          pipeline.intercept(({next}) => {
            order.push('B');
            next();
          });
          pipeline.intercept(({next, halt}) => {
            order.push('C');
            next();
            halt(); // no-op; chain already ran
          });
        }
      }

      await render(`<button test>Click</button>`, {imports: [Host]});
      keyDown(screen.getByRole('button'), 'x');
      expect(order).toEqual(['C', 'B', 'A']);
    });

    it('halted() reflects an inner handler halting', async () => {
      let sawHalt = false;

      @Directive({selector: '[test]', hostDirectives: [TestOnKeyDown]})
      class Host {
        constructor() {
          const pipeline = inject(TestOnKeyDown);
          pipeline.intercept(({halt}) => halt()); // inner halts
          pipeline.intercept(({next, halted}) => {
            next();
            sawHalt = halted();
          });
        }
      }

      await render(`<button test>Click</button>`, {imports: [Host]});
      keyDown(screen.getByRole('button'), 'x');
      expect(sawHalt).toBe(true);
    });
  });

  describe('preventDefault()', () => {
    it('calls event.preventDefault()', async () => {
      @Directive({selector: '[test]', hostDirectives: [TestOnKeyDown]})
      class Host {
        constructor() {
          inject(TestOnKeyDown).intercept(({event}) => event.preventDefault());
        }
      }

      await render(`<button test>Click</button>`, {imports: [Host]});
      const event = keyDown(screen.getByRole('button'), ' ');
      expect(event.defaultPrevented).toBe(true);
    });

    it('idempotent — multiple preventDefault() calls are safe', async () => {
      @Directive({selector: '[test]', hostDirectives: [TestOnKeyDown]})
      class Host {
        constructor() {
          const pipeline = inject(TestOnKeyDown);
          pipeline.intercept(({event}) => event.preventDefault());
          pipeline.intercept(({next, event}) => {
            event.preventDefault();
            next();
          });
        }
      }

      await render(`<button test>Click</button>`, {imports: [Host]});
      const event = keyDown(screen.getByRole('button'), ' ');
      expect(event.defaultPrevented).toBe(true);
    });

    it('defaultPrevented() reflects earlier preventDefault() calls in the same dispatch', async () => {
      let innerSawPrevented = false;

      @Directive({selector: '[test]', hostDirectives: [TestOnKeyDown]})
      class Host {
        constructor() {
          const pipeline = inject(TestOnKeyDown);
          pipeline.intercept(({event}) => {
            innerSawPrevented = event.defaultPrevented;
          }); // inner
          pipeline.intercept(({next, event}) => {
            event.preventDefault();
            next();
          }); // outer
        }
      }

      await render(`<button test>Click</button>`, {imports: [Host]});
      keyDown(screen.getByRole('button'), ' ');
      expect(innerSawPrevented).toBe(true);
    });
  });

  describe('handler removal', () => {
    it('manually-removed handler no longer fires', async () => {
      const spy = vi.fn();

      @Directive({selector: '[test]', hostDirectives: [TestOnKeyDown]})
      class Host {
        remove!: () => void;
        constructor() {
          this.remove = inject(TestOnKeyDown).intercept(() => spy());
        }
      }

      const {fixture} = await render(`<button test>Click</button>`, {imports: [Host]});
      const host = fixture.debugElement.children[0].injector.get(Host);
      const button = screen.getByRole('button');

      keyDown(button, 'a');
      expect(spy).toHaveBeenCalledTimes(1);

      host.remove();
      keyDown(button, 'b');
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('size', () => {
    it('tracks number of registered handlers', async () => {
      @Directive({selector: '[test]', hostDirectives: [TestOnKeyDown]})
      class Host {
        readonly pipeline = inject(TestOnKeyDown);
        remove1!: () => void;
        remove2!: () => void;
        constructor() {
          this.remove1 = this.pipeline.intercept(() => void 0);
          this.remove2 = this.pipeline.intercept(() => void 0);
        }
      }

      const {fixture} = await render(`<button test>Click</button>`, {imports: [Host]});
      const host = fixture.debugElement.children[0].injector.get(Host);
      expect(host.pipeline.size()).toBe(2);

      host.remove1();
      expect(host.pipeline.size()).toBe(1);

      host.remove2();
      expect(host.pipeline.size()).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Composition — real-world patterns
  // ---------------------------------------------------------------------------

  describe('composition: disabled primitive blocks keyboard activation', () => {
    it('a disabled check at the inner primitive short-circuits activation', async () => {
      const clickSpy = vi.fn();

      @Directive({selector: '[btn]', hostDirectives: [TestOnKeyDown]})
      class Btn {
        readonly disabled = signal(false);
        readonly el = inject(ElementRef).nativeElement as HTMLElement;
        constructor() {
          inject(TestOnKeyDown).intercept(({event, halt}) => {
            if (this.disabled()) {
              halt();
              return;
            }
            if (event.key === 'Enter') this.el.click();
          });
        }
      }

      @Directive({selector: '[test]', hostDirectives: [Btn]})
      class Host {
        readonly btn = inject(Btn);
      }

      const {fixture} = await render(`<div test role="button" (click)="onClick()">Act</div>`, {
        imports: [Host],
        componentProperties: {onClick: clickSpy},
      });
      const host = fixture.debugElement.children[0].injector.get(Host);
      const el = screen.getByRole('button');

      keyDown(el, 'Enter');
      expect(clickSpy).toHaveBeenCalledTimes(1);

      host.btn.disabled.set(true);
      fixture.detectChanges();
      keyDown(el, 'Enter');
      expect(clickSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('composition: outer directive intercepts before inner primitive', () => {
    // Btn constructs first (innermost) → registers first → runs LAST.
    // MenuItem constructs second (outer) → registers last → runs FIRST.
    // So MenuItem gets first crack at keydown; Btn is reached via next().

    it('outer intercepts Space; inner still handles Enter via next()', async () => {
      const innerKeydownSpy = vi.fn();
      const menuItemActivated = vi.fn();

      @Directive({selector: '[btn]', hostDirectives: [TestOnKeyDown, TestOnKeyUp]})
      class Btn {
        readonly el = inject(ElementRef).nativeElement as HTMLElement;
        constructor() {
          inject(TestOnKeyDown).intercept(({event}) => {
            innerKeydownSpy(event.key);
            if (event.key === ' ') event.preventDefault(); // default: prevent scroll
          });
          inject(TestOnKeyUp).intercept(({event}) => {
            if (event.key === ' ') this.el.click(); // default: Space fires on keyup
          });
        }
      }

      @Directive({selector: '[menuItem]', hostDirectives: [Btn]})
      class MenuItem {
        constructor() {
          inject(TestOnKeyDown).intercept(({event, next, halt}) => {
            if (event.key === ' ') {
              event.preventDefault();
              menuItemActivated();
              halt();
              return;
            }
            next();
          });
          inject(TestOnKeyUp).intercept(({event, next}) => {
            if (event.key === ' ') {
              event.preventDefault();
              return; // swallow — activation already happened on keydown
            }
            next();
          });
        }
      }

      await render(`<button menuItem>Item</button>`, {imports: [MenuItem]});
      const button = screen.getByRole('button');

      keyDown(button, ' ');
      expect(menuItemActivated).toHaveBeenCalledTimes(1);
      expect(innerKeydownSpy).not.toHaveBeenCalled();

      keyUp(button, ' ');

      keyDown(button, 'Enter');
      expect(innerKeydownSpy).toHaveBeenCalledWith('Enter');
    });
  });

  describe('composition: nested 3-level', () => {
    // Construction order: Btn → Trigger → Toolbar (outermost).
    // LIFO execution: Toolbar → Trigger → Btn.

    it('Enter flows through every layer', async () => {
      const order: string[] = [];

      @Directive({selector: '[btn]', hostDirectives: [TestOnKeyDown]})
      class Btn {
        constructor() {
          inject(TestOnKeyDown).intercept(({event}) => {
            order.push(`btn:${event.key}`);
          });
        }
      }

      @Directive({selector: '[trigger]', hostDirectives: [Btn]})
      class Trigger {
        constructor() {
          inject(TestOnKeyDown).intercept(({event, next, halt}) => {
            if (event.key === 'ArrowDown') {
              order.push('trigger:open-menu');
              halt();
              return;
            }
            next();
          });
        }
      }

      @Directive({selector: '[toolbar]', hostDirectives: [Trigger]})
      class Toolbar {
        constructor() {
          inject(TestOnKeyDown).intercept(({event, next}) => {
            order.push(`toolbar:${event.key}`);
            next();
          });
        }
      }

      await render(`<button toolbar>Menu</button>`, {imports: [Toolbar]});
      const button = screen.getByRole('button');

      keyDown(button, 'Enter');
      expect(order).toEqual(['toolbar:Enter', 'btn:Enter']);

      order.length = 0;
      keyDown(button, 'ArrowDown');
      // Toolbar runs, delegates; Trigger intercepts + halts; Btn never runs.
      expect(order).toEqual(['toolbar:ArrowDown', 'trigger:open-menu']);
    });
  });

  describe('composition: soft-disabled blocks activation but allows focus keys', () => {
    it('blocks Enter/Space; allows Tab through', async () => {
      const activationSpy = vi.fn();
      const tabSpy = vi.fn();

      @Directive({selector: '[btn]', hostDirectives: [TestOnKeyDown]})
      class Btn {
        readonly disabled = signal<boolean | 'soft'>(false);
        constructor() {
          inject(TestOnKeyDown).intercept(({event, halt}) => {
            const state = this.disabled();
            if (state === true) {
              halt();
              return;
            }
            if (state === 'soft' && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault();
              halt();
              return;
            }
            if (event.key === 'Enter' || event.key === ' ') {
              activationSpy(event.key);
            } else if (event.key === 'Tab') {
              tabSpy();
            }
          });
        }
      }

      @Directive({selector: '[test]', hostDirectives: [Btn]})
      class Host {
        readonly btn = inject(Btn);
      }

      const {fixture} = await render(`<button test>Act</button>`, {imports: [Host]});
      const host = fixture.debugElement.children[0].injector.get(Host);
      const button = screen.getByRole('button');

      keyDown(button, 'Enter');
      keyDown(button, 'Tab');
      expect(activationSpy).toHaveBeenCalledTimes(1);
      expect(tabSpy).toHaveBeenCalledTimes(1);

      host.btn.disabled.set('soft');
      fixture.detectChanges();
      activationSpy.mockClear();
      tabSpy.mockClear();

      keyDown(button, 'Enter');
      keyDown(button, ' ');
      keyDown(button, 'Tab');
      expect(activationSpy).not.toHaveBeenCalled();
      expect(tabSpy).toHaveBeenCalledTimes(1);

      host.btn.disabled.set(true);
      fixture.detectChanges();
      tabSpy.mockClear();

      keyDown(button, 'Enter');
      keyDown(button, 'Tab');
      expect(activationSpy).not.toHaveBeenCalled();
      expect(tabSpy).not.toHaveBeenCalled();
    });
  });
});
