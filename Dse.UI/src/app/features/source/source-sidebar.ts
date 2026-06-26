import {Source} from '#core/source/source';
import {Component, inject} from '@angular/core';
import {RouterLink} from '@angular/router';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideChevronLeft} from '@ng-icons/lucide';
import {HlmButton} from '@spartan-ng/helm/button';
import {HlmSidebarImports} from '@spartan-ng/helm/sidebar';

@Component({
  selector: 'source-sidebar',
  imports: [HlmSidebarImports, HlmButton, NgIcon, RouterLink],
  providers: [provideIcons({lucideChevronLeft})],
  template: `
    <div class="h-12 flex-row items-center gap-1 px-2" hlmSidebarHeader>
      <button
        aria-label="Back to sources"
        hlmBtn
        size="icon-sm"
        variant="ghost"
        [routerLink]="[{outlets: {sidebar: ['home']}}]"
      >
        <ng-icon name="lucideChevronLeft" />
      </button>
      <span class="font-heading text-base font-semibold tracking-tight">{{ source.options.name }}</span>
    </div>
    <div hlmSidebarContent>
      <div hlmSidebarGroup>
        <div hlmSidebarGroupLabel>Filters</div>
        <div class="text-muted-foreground px-2 text-sm" hlmSidebarGroupContent>Coming soon.</div>
      </div>
    </div>
  `,
})
export default class SourceSidebar {
  protected readonly source = inject(Source);
}
