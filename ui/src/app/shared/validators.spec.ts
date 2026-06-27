import {assertNotNil, isFunction, isNil, isNonEmptyArray, isNonEmptyString, isRecord, notNil} from './validators';

describe('validators', () => {
  describe('isNil', () => {
    it('should return true for null and undefined', () => {
      expect(isNil(null)).toBe(true);
      expect(isNil(undefined)).toBe(true);
    });
    it('should return false for defined values including falsy ones', () => {
      expect(isNil(0)).toBe(false);
      expect(isNil('')).toBe(false);
      expect(isNil(false)).toBe(false);
      expect(isNil({})).toBe(false);
    });
  });

  describe('notNil', () => {
    it('should be the inverse of isNil', () => {
      expect(notNil(null)).toBe(false);
      expect(notNil(undefined)).toBe(false);
      expect(notNil(0)).toBe(true);
      expect(notNil('x')).toBe(true);
    });
    it('should work as a filter predicate', () => {
      const arr: (string | null | undefined)[] = ['a', null, 'b', undefined, 'c'];
      expect(arr.filter(notNil)).toEqual(['a', 'b', 'c']);
    });
  });

  describe('isFunction', () => {
    it('should return true for functions', () => {
      expect(isFunction(() => {})).toBe(true);
      expect(isFunction(function () {})).toBe(true);
      expect(isFunction(class {})).toBe(true);
    });
    it('should return false for non-functions', () => {
      expect(isFunction(null)).toBe(false);
      expect(isFunction(42)).toBe(false);
      expect(isFunction({})).toBe(false);
    });
  });

  describe('assertNotNil', () => {
    it('should not throw for defined values', () => {
      expect(() => assertNotNil('x')).not.toThrow();
      expect(() => assertNotNil(0)).not.toThrow();
    });
    it('should throw TypeError for null or undefined', () => {
      expect(() => assertNotNil(null)).toThrow(TypeError);
      expect(() => assertNotNil(undefined)).toThrow(TypeError);
    });
    it('should use custom message when provided', () => {
      expect(() => assertNotNil(null, 'custom')).toThrow('custom');
    });
  });

  describe('isNonEmptyString', () => {
    it('should return false for non-strings', () => {
      expect(isNonEmptyString(null)).toBe(false);
      expect(isNonEmptyString(42)).toBe(false);
    });
    it('should return true for strings with content', () => {
      expect(isNonEmptyString('x')).toBe(true);
    });
    it('should return false for empty string', () => {
      expect(isNonEmptyString('')).toBe(false);
    });
    it('should respect trim option', () => {
      expect(isNonEmptyString('   ')).toBe(true);
      expect(isNonEmptyString('   ', {trim: true})).toBe(false);
      expect(isNonEmptyString(' x ', {trim: true})).toBe(true);
    });
  });

  describe('isNonEmptyArray', () => {
    it('should return false for null, undefined, and empty arrays', () => {
      expect(isNonEmptyArray(null)).toBe(false);
      expect(isNonEmptyArray(undefined)).toBe(false);
      expect(isNonEmptyArray([])).toBe(false);
    });
    it('should return true for arrays with at least one element', () => {
      expect(isNonEmptyArray([1])).toBe(true);
      expect(isNonEmptyArray(['a', 'b'])).toBe(true);
    });
  });

  describe('isRecord', () => {
    it('should return true for plain object literals', () => {
      expect(isRecord({})).toBe(true);
      expect(isRecord({a: 1})).toBe(true);
      expect(isRecord(Object.create(null))).toBe(true);
    });
    it('should return false for null and primitives', () => {
      expect(isRecord(null)).toBe(false);
      expect(isRecord(42)).toBe(false);
      expect(isRecord('s')).toBe(false);
    });
    it('should return false for iterables (arrays, Maps, Sets)', () => {
      expect(isRecord([])).toBe(false);
      expect(isRecord(new Map())).toBe(false);
      expect(isRecord(new Set())).toBe(false);
    });
    it('should return false for built-in non-record instances', () => {
      expect(isRecord(new Date())).toBe(false);
      expect(isRecord(new Error('x'))).toBe(false);
      expect(isRecord(/re/)).toBe(false);
      expect(isRecord(Promise.resolve())).toBe(false);
    });
    it('should return false for class instances', () => {
      class C {}
      expect(isRecord(new C())).toBe(false);
    });
    it('should return false for built-in non-record instances 2', () => {
      expect(isRecord(new WeakMap())).toBe(false);
      expect(isRecord(new WeakSet())).toBe(false);
    });
  });
});
