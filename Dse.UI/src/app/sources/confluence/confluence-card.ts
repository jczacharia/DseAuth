import type {ConfluenceDoc} from '#api/types.gen';
import {type SearchCard} from '#core/source/source';
import {SourceRegistry} from '#core/source/source-registry';
import {DateFromNowPipe} from '#shared/date-from-now.pipe';
import {Component, computed, inject, input} from '@angular/core';
import type {estypes} from '@elastic/elasticsearch';
import {NgIcon} from '@ng-icons/core';

@Component({
  selector: 'confluence-card',
  imports: [NgIcon, DateFromNowPipe],
  host: {class: 'block'},
  template: `
    <article
      class="group border-border hover:bg-muted/40 flex flex-col gap-1.5 rounded-lg border p-3 transition-colors"
      [style.--source-color]="source()?.options?.color"
    >
      <div class="flex items-center gap-2 text-xs">
        <ng-icon class="text-sm" style="color: var(--source-color)" [name]="source()?.options?.icon ?? ''" />
        <span class="text-muted-foreground font-mono">{{ doc().space?.name ?? 'Confluence' }}</span>
        <span class="text-muted-foreground/60 font-mono">· {{ doc().versionWhen | dateFromNow }} ago</span>
      </div>
      <h3 class="group-hover:text-primary font-medium">{{ doc().title }}</h3>
      <p class="text-muted-foreground line-clamp-2 text-sm">{{ doc().body }}</p>
    </article>
  `,
})
export default class ConfluenceCard implements SearchCard<ConfluenceDoc> {
  readonly #registry = inject(SourceRegistry);
  readonly hit = input.required<estypes.SearchHit<ConfluenceDoc>>();
  protected readonly doc = computed(() => this.hit()._source ?? ({} as ConfluenceDoc));
  protected readonly source = computed(() => this.#registry.sourceForIndex(this.hit()._index ?? ''));
}
