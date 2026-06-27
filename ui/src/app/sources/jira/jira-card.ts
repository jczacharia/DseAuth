import {type SearchCard} from '#core/source/source';
import {SourceRegistry} from '#core/source/source-registry';
import {DateFromNowPipe} from '#shared/date-from-now.pipe';
import {Component, computed, inject, input} from '@angular/core';
import type {estypes} from '@elastic/elasticsearch';
import {NgIcon} from '@ng-icons/core';
import type {JiraDoc} from './jira-doc';

@Component({
  selector: 'jira-card',
  imports: [NgIcon, DateFromNowPipe],
  host: {class: 'block'},
  template: `
    <article
      class="group border-border hover:bg-muted/40 flex flex-col gap-1.5 rounded-lg border p-3 transition-colors"
      [style.--source-color]="source()?.options?.color"
    >
      <div class="flex items-center gap-2 text-xs">
        <ng-icon class="text-sm" style="color: var(--source-color)" [name]="source()?.options?.icon ?? ''" />
        <span class="text-muted-foreground font-mono">{{ doc().key }}</span>
        <span
          class="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[10px] tracking-wide uppercase"
        >
          {{ doc().status }}
        </span>
        <span class="text-muted-foreground/60 font-mono">· {{ doc().updated | dateFromNow }} ago</span>
      </div>
      <h3 class="group-hover:text-primary font-medium">{{ doc().summary }}</h3>
      @if (doc().assignee?.displayName) {
        <p class="text-muted-foreground text-sm">Assigned to {{ doc().assignee?.displayName }}</p>
      }
    </article>
  `,
})
export default class JiraCard implements SearchCard<JiraDoc> {
  readonly #registry = inject(SourceRegistry);
  readonly hit = input.required<estypes.SearchHit<JiraDoc>>();
  protected readonly doc = computed(() => this.hit()._source!);
  protected readonly source = computed(() => this.#registry.sourceForIndex(this.hit()._index ?? ''));
}
