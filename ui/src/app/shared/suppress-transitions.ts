import {injectElement} from '#shared/inject-element';
import {Timeout} from '#shared/timeout';
import {isPlatformServer} from '@angular/common';
import {Directive, inject, PLATFORM_ID, Renderer2, RendererStyleFlags2} from '@angular/core';

/** Briefly sets `transition: none` around first paint to avoid flickers. */
@Directive()
export class SuppressTransitions {
  constructor() {
    if (isPlatformServer(inject(PLATFORM_ID))) {
      return;
    }

    const el = injectElement();
    const renderer = inject(Renderer2);
    const prev = el.style.getPropertyValue('transition');
    const prevPriority = el.style.getPropertyPriority('transition');
    renderer.setStyle(el, 'transition', 'none', RendererStyleFlags2.Important);

    // Restore after first paint — the browser has applied the hydrated
    // classes with transitions disabled, so re-enabling is safe.
    Timeout.spawn(0, () => {
      if (prev) {
        renderer.setStyle(
          el,
          'transition',
          prev,
          prevPriority === 'important' ? RendererStyleFlags2.Important : undefined,
        );
      } else {
        renderer.removeStyle(el, 'transition');
      }
    });
  }
}
