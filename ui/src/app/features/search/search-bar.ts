import {Search} from '#core/search/search';
import {Component, effect, inject, signal, untracked} from '@angular/core';
import {takeUntilDestroyed, toObservable} from '@angular/core/rxjs-interop';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideSearch} from '@ng-icons/lucide';
import {HlmInput} from '@spartan-ng/helm/input';
import {debounceTime, distinctUntilChanged} from 'rxjs';

@Component({
  selector: 'search-bar',
  imports: [HlmInput, NgIcon],
  providers: [provideIcons({lucideSearch})],
  host: {class: 'block'},
  template: `
    <div class="relative">
      <ng-icon
        class="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base"
        name="lucideSearch"
      />
      <input
        autocomplete="off"
        class="h-9 w-full pl-9"
        hlmInput
        placeholder="Search everything…"
        spellcheck="false"
        type="search"
        [value]="text()"
        (input)="onInput($event)"
        (keydown.escape)="text.set('')"
      />
    </div>
  `,
})
export default class SearchBar {
  protected readonly search = inject(Search);
  protected readonly text = signal(this.search.query() ?? '');

  constructor() {
    // URL → input: keep the field in sync with the source of truth (back/forward, source switch).
    effect(() => {
      const q = this.search.query() ?? '';
      if (q !== untracked(this.text)) this.text.set(q);
    });
    // input → URL, debounced; never echo a value the URL already holds.
    toObservable(this.text)
      .pipe(debounceTime(200), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => {
        if (q !== (this.search.query() ?? '')) this.search.set(q);
      });
  }

  protected onInput(event: Event): void {
    this.text.set((event.target as HTMLInputElement).value);
  }
}
