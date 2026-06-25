import {Timeout} from '#shared/timeout';
import {Injector} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {vi} from 'vitest';

describe('Timeout', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('should fire the scheduled callback after the delay', () => {
    TestBed.runInInjectionContext(() => {
      const spy = vi.fn();
      const t = Timeout.create();
      t.set(100, spy);
      expect(t.isSet).toBe(true);
      vi.advanceTimersByTime(100);
      expect(spy).toHaveBeenCalledOnce();
      expect(t.isSet).toBe(false);
    });
  });

  it('spawn() schedules immediately', () => {
    TestBed.runInInjectionContext(() => {
      const spy = vi.fn();
      Timeout.spawn(50, spy);
      vi.advanceTimersByTime(50);
      expect(spy).toHaveBeenCalledOnce();
    });
  });

  it('clear() cancels a pending callback', () => {
    TestBed.runInInjectionContext(() => {
      const spy = vi.fn();
      const t = Timeout.create();
      t.set(100, spy);
      t.clear();
      expect(t.isSet).toBe(false);
      vi.advanceTimersByTime(200);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  it('set() replaces a previously pending callback', () => {
    TestBed.runInInjectionContext(() => {
      const first = vi.fn();
      const second = vi.fn();
      const t = Timeout.create();
      t.set(100, first);
      t.set(50, second);
      vi.advanceTimersByTime(50);
      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledOnce();
    });
  });

  it('destroy() cancels any pending work', () => {
    TestBed.runInInjectionContext(() => {
      const spy = vi.fn();
      const t = Timeout.create();
      t.set(100, spy);
      t.destroy();
      vi.advanceTimersByTime(200);
      expect(spy).not.toHaveBeenCalled();
    });
  });

  it('should tear down when the owning injector is destroyed', () => {
    const parent = TestBed.inject(Injector);
    const child = Injector.create({parent, providers: []});
    const spy = vi.fn();
    const t = Timeout.create(child);
    t.set(100, spy);
    child.destroy();
    vi.advanceTimersByTime(200);
    expect(spy).not.toHaveBeenCalled();
    expect(t.isSet).toBe(false);
  });

  it('clear() is a no-op when nothing is scheduled', () => {
    TestBed.runInInjectionContext(() => {
      const t = Timeout.create();
      expect(() => t.clear()).not.toThrow();
      expect(t.isSet).toBe(false);
    });
  });
});
