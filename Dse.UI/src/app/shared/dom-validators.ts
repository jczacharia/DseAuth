/**
 * Use when narrowing an unknown value (e.g. `event.target`) to `Element` for same-realm DOM code.
 */
export function isElement(value: unknown): value is Element {
  return value instanceof Element;
}

/**
 * Use when the element may originate from another document (e.g. an iframe), since `instanceof
 * Element` in the parent realm would wrongly reject it.
 */
export function isElementCrossRealm(value: unknown): value is Element {
  if (!value || typeof value !== 'object') return false;
  const node = value as Node;
  const ctor = node.ownerDocument?.defaultView?.Element;
  return ctor ? node instanceof ctor : node instanceof Element;
}

/** Use when you need to narrow to `HTMLElement` specifically (e.g. before reading `.focus()`). */
export function isHTMLElement(value: unknown): value is HTMLElement {
  return value instanceof HTMLElement;
}

/**
 * Use to distinguish a native `<button>` — optionally restricted to certain `type` attributes —
 * from button-like ARIA widgets.
 */
export function isButtonElement<E extends Element>(
  element: E,
  {types}: {types?: readonly string[]} = {},
): element is E & HTMLButtonElement {
  if (!(element instanceof HTMLButtonElement)) return false;
  return !types?.length || types.includes(element.type);
}

/**
 * Use to detect a native `<input>` — optionally restricted to certain `type` attributes — before
 * branching on input-specific behavior.
 */
export function isInputElement<E extends Element>(
  element: E,
  {types}: {types?: readonly string[]} = {},
): element is E & HTMLInputElement {
  if (!(element instanceof HTMLInputElement)) return false;
  return !types?.length || types.includes(element.type);
}

/** Use when you need to narrow an element to an `<a>` before reading anchor-specific properties. */
export function isAnchorElement<E extends Element>(element: E): element is E & HTMLAnchorElement {
  return element instanceof HTMLAnchorElement;
}

/**
 * Use when an anchor should only be treated as a real link (activatable target) and decorative
 * `<a>` tags without `href`/`routerLink` should be ignored.
 */
export function isValidLink<E extends Element>(element: E): element is E & HTMLAnchorElement {
  return isAnchorElement(element) && (!!element.getAttribute('href') || !!element.getAttribute('routerLink'));
}

/**
 * Use when deciding whether a global keybinding should be suppressed because the user is editing
 * text (native inputs, textareas, `[contenteditable]`, or ARIA textbox/searchbox roles).
 */
export function isTypeableElement(
  value: unknown,
  {includeReadonly = false}: {includeReadonly?: boolean} = {},
): value is HTMLElement {
  if (!(value instanceof Element)) return false;
  const selector = includeReadonly ? TYPEABLE_SELECTOR_ALL : TYPEABLE_SELECTOR;
  return value.matches(selector);
}

const TYPEABLE_BASE =
  "input:not([type='hidden']):not([type='button']):not([type='submit']):not([type='reset']):not([type='checkbox']):not([type='radio']):not([disabled])," +
  'textarea:not([disabled]),' +
  "[contenteditable]:not([contenteditable='false'])," +
  "[role='textbox']:not([aria-disabled='true'])," +
  "[role='searchbox']:not([aria-disabled='true'])";

const TYPEABLE_SELECTOR = TYPEABLE_BASE.replaceAll(',', ':not([readonly]),') + ':not([readonly])';
const TYPEABLE_SELECTOR_ALL = TYPEABLE_BASE;

/**
 * Use before reading or writing `.disabled` on a generic element, so the narrowing is safe for
 * any native form control that exposes the property.
 */
export function supportsDisabled<E extends Element>(element: E): element is E & {disabled: boolean} {
  return (
    element instanceof HTMLButtonElement ||
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLFieldSetElement ||
    element instanceof HTMLOptionElement ||
    element instanceof HTMLOptGroupElement
  );
}

/** Use before reading or writing `.required` on a generic element to avoid unsafe casts. */
export function supportsRequired<E extends Element>(element: E): element is E & {required: boolean} {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement
  );
}

/** Use when narrowing an `unknown` value to `EventTarget` before attaching listeners or dispatching. */
export function isEventTarget(value: unknown): value is EventTarget {
  return value instanceof EventTarget;
}

/**
 * Use when deciding whether an interaction should be suppressed because the element is disabled,
 * accounting for both native `disabled` and ARIA composite widgets using `aria-disabled`.
 */
export function isEffectivelyDisabled(element: Element): boolean {
  if (supportsDisabled(element) && element.disabled) return true;
  return element.getAttribute('aria-disabled') === 'true';
}

/**
 * Use inside composite-widget activation code to detect roles where Space is consumed by
 * typeahead, so activation is skipped if the host already called `preventDefault`.
 */
export function isTextNavigationRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return role === 'option' || role === 'gridcell' || role.startsWith('menuitem');
}

/**
 * Use when wiring Enter/Space activation semantics for a role-driven element, to decide whether
 * keyboard activation should be treated like a button press.
 */
export function isButtonLikeRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return (
    role === 'button' ||
    role === 'link' ||
    role === 'menuitem' ||
    role === 'menuitemcheckbox' ||
    role === 'menuitemradio' ||
    role === 'tab' ||
    role === 'option' ||
    role === 'switch' ||
    role === 'checkbox' ||
    role === 'radio'
  );
}

/**
 * Use when implementing roving-tabindex or focus-movement logic to identify elements that should
 * be treated as focusable items within a composite widget.
 */
export function isCompositeItemRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return (
    role === 'option' ||
    role === 'menuitem' ||
    role === 'menuitemcheckbox' ||
    role === 'menuitemradio' ||
    role === 'tab' ||
    role === 'treeitem' ||
    role === 'gridcell' ||
    role === 'row'
  );
}

/**
 * Use at directive boundaries to assert an input resolved to an `EventTarget` and produce a
 * helpful error (including a `viewChild({read: ElementRef})` hint) when it did not.
 */
export function assertEventTarget(value: unknown, source: string): asserts value is EventTarget {
  if (!isEventTarget(value)) {
    const received = value == null ? String(value) : (value.constructor?.name ?? typeof value);
    throw new Error(
      `[${source}] Expected an EventTarget, ElementRef but received: ${received}. ` +
        `If you are using viewChild/contentChild, specify "{ read: ElementRef }" to avoid implicit directive references.`,
    );
  }
}
