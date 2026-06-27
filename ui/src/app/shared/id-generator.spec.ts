import {inject} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {IdGenerator} from './id-generator';

describe(IdGenerator.toString(), () => {
  it('should mint prefixed ids that increment per prefix', () => {
    TestBed.runInInjectionContext(() => {
      const gen = inject(IdGenerator);
      expect(gen('menu')).toBe('menu-1');
      expect(gen('menu')).toBe('menu-2');
      expect(gen('other')).toBe('other-1');
      expect(gen('menu')).toBe('menu-3');
    });
  });

  it('should default the prefix when called with no args', () => {
    TestBed.runInInjectionContext(() => {
      const gen = inject(IdGenerator);
      expect(gen('dse')).toMatch(/^dse-\d+$/);
    });
  });
});
