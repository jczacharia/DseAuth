import {isPlatformBrowser} from '@angular/common';
import {computed, DOCUMENT, effect, inject, PLATFORM_ID, Service} from '@angular/core';
import {listener, mediaQuery, storage} from '@signality/core';
import {constSignal} from '@signality/core/internal';

export type AppTheme = 'light' | 'dark';

@Service()
export class Theme {
  readonly #doc = inject(DOCUMENT);
  readonly #storage = storage<AppTheme | null>('adv-theme', null);

  readonly prefersDark = isPlatformBrowser(inject(PLATFORM_ID))
    ? constSignal(true)
    : mediaQuery('(prefers-color-scheme: dark)', {initialValue: true});

  readonly value = computed(() => this.#storage() ?? (this.prefersDark() ? 'dark' : 'light'));
  readonly inverse = computed(() => (this.value() === 'light' ? 'dark' : 'light'));

  constructor() {
    effect(() => {
      this.#doc.documentElement.classList.remove('light', 'dark');
      this.#doc.documentElement.classList.add(this.value());
    });

    listener(this.#doc, 'keydown', (event) => {
      if (event.key === 't' && event.altKey) {
        this.toggle();
      }
    });
  }

  set(theme: AppTheme | 'system') {
    if (theme === 'system') {
      this.#storage.set(null);
    } else {
      this.#storage.set(theme);
    }
  }

  toggle() {
    this.set(this.value() === 'light' ? 'dark' : 'light');
  }
}
