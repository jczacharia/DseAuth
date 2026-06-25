import {buildSearchBody} from '#core/search/es-query';
import {Search} from '#core/search/search';
import {SourceCardPipe} from '#core/search/source-card.pipe';
import {Source} from '#core/source/source';
import {AsyncPipe, NgComponentOutlet} from '@angular/common';
import {httpResource} from '@angular/common/http';
import {Component, computed, inject} from '@angular/core';
import type {estypes} from '@elastic/elasticsearch';
import {HlmSpinner} from '@spartan-ng/helm/spinner';

@Component({
  selector: 'source-page',
  imports: [NgComponentOutlet, AsyncPipe, SourceCardPipe, HlmSpinner],
  template: `
    @if (query()) {
      <div class="mx-auto flex w-full max-w-3xl flex-col gap-3 p-4">
        @if (results.isLoading()) {
          <div class="flex justify-center p-10"><hlm-spinner /></div>
        } @else if (results.error()) {
          <p class="text-destructive p-4 text-sm">Search failed — {{ results.error() }}</p>
        } @else {
          <p class="text-muted-foreground font-mono text-xs">{{ total() }} results · “{{ query() }}”</p>
          @for (hit of hits(); track hit._id) {
            <ng-container *ngComponentOutlet="(hit | sourceCard | async) ?? null; inputs: {hit: hit}" />
          } @empty {
            <p class="text-muted-foreground p-4 text-sm">No results found.</p>
          }
        }
      </div>
    } @else {
      <div class="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start gap-2 p-8">
        <h1 class="font-heading text-3xl font-semibold tracking-tight">{{ source.options.name }}</h1>
        <p class="text-muted-foreground max-w-prose">{{ source.options.description }}</p>
        <p class="text-muted-foreground/70 mt-6 text-sm">Search to get started.</p>
      </div>
    }
  `,
})
export default class SourcePage {
  protected readonly source = inject(Source);
  protected readonly search = inject(Search);

  protected readonly query = computed(() => this.search.query()?.trim() ?? '');

  protected readonly results = httpResource<estypes.SearchResponse>(() => {
    const q = this.query();
    if (!q) return undefined;
    return {url: this.source.searchPath, method: 'POST', body: buildSearchBody(q)};
  });

  protected readonly hits = computed(() => this.results.value()?.hits?.hits ?? []);
  protected readonly total = computed(() => {
    const total = this.results.value()?.hits?.total;
    return typeof total === 'number' ? total : (total?.value ?? 0);
  });
}
