import {
  assertEventTarget,
  isAnchorElement,
  isButtonElement,
  isButtonLikeRole,
  isCompositeItemRole,
  isEffectivelyDisabled,
  isElement,
  isElementCrossRealm,
  isEventTarget,
  isHTMLElement,
  isInputElement,
  isTextNavigationRole,
  isTypeableElement,
  isValidLink,
  supportsDisabled,
  supportsRequired,
} from './dom-validators';

function el(html: string): HTMLElement {
  const div = document.createElement('div');
  div.innerHTML = html.trim();
  return div.firstElementChild as HTMLElement;
}

describe('dom-validators', () => {
  describe('isElement / isHTMLElement / isEventTarget', () => {
    it('should narrow DOM types correctly', () => {
      const node = document.createElement('div');
      expect(isElement(node)).toBe(true);
      expect(isHTMLElement(node)).toBe(true);
      expect(isEventTarget(node)).toBe(true);
    });
    it('should reject non-elements', () => {
      expect(isElement({})).toBe(false);
      expect(isHTMLElement({})).toBe(false);
      expect(isEventTarget('not')).toBe(false);
      expect(isEventTarget(null)).toBe(false);
    });
  });

  describe('isElementCrossRealm', () => {
    it('should accept a same-realm element', () => {
      expect(isElementCrossRealm(document.createElement('div'))).toBe(true);
    });
    it('should reject non-objects and null', () => {
      expect(isElementCrossRealm(null)).toBe(false);
      expect(isElementCrossRealm('s')).toBe(false);
      expect(isElementCrossRealm(42)).toBe(false);
    });
    it('should fall back to same-realm check when ownerDocument is unavailable', () => {
      const fake = {ownerDocument: null};
      expect(isElementCrossRealm(fake)).toBe(false);
    });
  });

  describe('isButtonElement', () => {
    it('should detect a native button', () => {
      expect(isButtonElement(el('<button>x</button>'))).toBe(true);
    });
    it('should reject non-button elements', () => {
      expect(isButtonElement(el('<div></div>'))).toBe(false);
    });
    it('should filter by type when types are provided', () => {
      const b = el('<button type="submit">x</button>') as HTMLButtonElement;
      expect(isButtonElement(b, {types: ['submit']})).toBe(true);
      expect(isButtonElement(b, {types: ['button']})).toBe(false);
      expect(isButtonElement(b, {types: []})).toBe(true);
    });
  });

  describe('isInputElement', () => {
    it('should detect a native input', () => {
      expect(isInputElement(el('<input />'))).toBe(true);
    });
    it('should reject other elements', () => {
      expect(isInputElement(el('<div></div>'))).toBe(false);
    });
    it('should filter by type', () => {
      const i = el('<input type="text" />') as HTMLInputElement;
      expect(isInputElement(i, {types: ['text']})).toBe(true);
      expect(isInputElement(i, {types: ['checkbox']})).toBe(false);
    });
  });

  describe('anchor helpers', () => {
    it('isAnchorElement narrows <a>', () => {
      expect(isAnchorElement(el('<a></a>'))).toBe(true);
      expect(isAnchorElement(el('<div></div>'))).toBe(false);
    });
    it('isValidLink requires href or routerLink', () => {
      expect(isValidLink(el('<a></a>'))).toBe(false);
      expect(isValidLink(el('<a href="/x"></a>'))).toBe(true);
      expect(isValidLink(el('<a routerLink="/x"></a>'))).toBe(true);
      expect(isValidLink(el('<div></div>'))).toBe(false);
    });
  });

  describe('isTypeableElement', () => {
    it('should detect common typeable inputs', () => {
      expect(isTypeableElement(el('<input type="text" />'))).toBe(true);
      expect(isTypeableElement(el('<textarea></textarea>'))).toBe(true);
      expect(isTypeableElement(el('<div contenteditable></div>'))).toBe(true);
    });
    it('should reject non-typeable inputs', () => {
      expect(isTypeableElement(el('<input type="checkbox" />'))).toBe(false);
      expect(isTypeableElement(el('<input type="hidden" />'))).toBe(false);
      expect(isTypeableElement(el('<button></button>'))).toBe(false);
    });
    it('should reject non-elements', () => {
      expect(isTypeableElement(null)).toBe(false);
      expect(isTypeableElement('x')).toBe(false);
    });
    it('should exclude readonly by default and include with includeReadonly', () => {
      const ro = el('<input type="text" readonly />');
      expect(isTypeableElement(ro)).toBe(false);
      expect(isTypeableElement(ro, {includeReadonly: true})).toBe(true);
    });
    it('should detect ARIA textbox and searchbox roles', () => {
      expect(isTypeableElement(el('<div role="textbox"></div>'))).toBe(true);
      expect(isTypeableElement(el('<div role="searchbox"></div>'))).toBe(true);
      expect(isTypeableElement(el('<div role="textbox" aria-disabled="true"></div>'))).toBe(false);
    });
  });

  describe('supportsDisabled / supportsRequired', () => {
    it('supportsDisabled covers native form controls', () => {
      expect(supportsDisabled(el('<button></button>'))).toBe(true);
      expect(supportsDisabled(el('<input />'))).toBe(true);
      expect(supportsDisabled(el('<select></select>'))).toBe(true);
      expect(supportsDisabled(el('<textarea></textarea>'))).toBe(true);
      expect(supportsDisabled(el('<fieldset></fieldset>'))).toBe(true);
      expect(supportsDisabled(el('<div></div>'))).toBe(false);
    });
    it('supportsRequired covers input/select/textarea only', () => {
      expect(supportsRequired(el('<input />'))).toBe(true);
      expect(supportsRequired(el('<select></select>'))).toBe(true);
      expect(supportsRequired(el('<textarea></textarea>'))).toBe(true);
      expect(supportsRequired(el('<button></button>'))).toBe(false);
      expect(supportsRequired(el('<div></div>'))).toBe(false);
    });
  });

  describe('isEffectivelyDisabled', () => {
    it('should return true for a natively disabled button', () => {
      expect(isEffectivelyDisabled(el('<button disabled></button>'))).toBe(true);
    });
    it('should return true for aria-disabled="true"', () => {
      expect(isEffectivelyDisabled(el('<div aria-disabled="true"></div>'))).toBe(true);
    });
    it('should return false for enabled elements', () => {
      expect(isEffectivelyDisabled(el('<button></button>'))).toBe(false);
      expect(isEffectivelyDisabled(el('<div></div>'))).toBe(false);
    });
  });

  describe('role helpers', () => {
    it('isTextNavigationRole', () => {
      expect(isTextNavigationRole(null)).toBe(false);
      expect(isTextNavigationRole(undefined)).toBe(false);
      expect(isTextNavigationRole('option')).toBe(true);
      expect(isTextNavigationRole('gridcell')).toBe(true);
      expect(isTextNavigationRole('menuitem')).toBe(true);
      expect(isTextNavigationRole('menuitemcheckbox')).toBe(true);
      expect(isTextNavigationRole('button')).toBe(false);
    });
    it('isButtonLikeRole', () => {
      expect(isButtonLikeRole(null)).toBe(false);
      for (const r of [
        'button',
        'link',
        'menuitem',
        'menuitemcheckbox',
        'menuitemradio',
        'tab',
        'option',
        'switch',
        'checkbox',
        'radio',
      ]) {
        expect(isButtonLikeRole(r)).toBe(true);
      }
      expect(isButtonLikeRole('treeitem')).toBe(false);
    });
    it('isCompositeItemRole', () => {
      expect(isCompositeItemRole(null)).toBe(false);
      for (const r of [
        'option',
        'menuitem',
        'menuitemcheckbox',
        'menuitemradio',
        'tab',
        'treeitem',
        'gridcell',
        'row',
      ]) {
        expect(isCompositeItemRole(r)).toBe(true);
      }
      expect(isCompositeItemRole('button')).toBe(false);
    });
  });

  describe('assertEventTarget', () => {
    it('should not throw for EventTarget-like values', () => {
      expect(() => assertEventTarget(document.createElement('div'), 'test')).not.toThrow();
    });
    it('should throw with a descriptive error otherwise', () => {
      expect(() => assertEventTarget({}, 'test')).toThrow(/Expected an EventTarget/);
      expect(() => assertEventTarget(null, 'test')).toThrow(/null/);
      expect(() => assertEventTarget(undefined, 'test')).toThrow(/undefined/);
      expect(() => assertEventTarget('str', 'test')).toThrow(/String/);
    });
  });
});
