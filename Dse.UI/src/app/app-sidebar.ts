import {SourceRegistry} from '#core/source/source-registry';
import {Component, inject} from '@angular/core';
import {RouterLink} from '@angular/router';
import {NgIcon} from '@ng-icons/core';
import {HlmSidebarImports} from '@spartan-ng/helm/sidebar';

@Component({
  selector: 'app-sidebar',
  imports: [HlmSidebarImports, NgIcon, RouterLink],
  template: `
    <div hlmSidebarContent>
      <div hlmSidebarGroup>
        <div hlmSidebarGroupLabel>Sources</div>
        <div hlmSidebarGroupContent>
          <ul hlmSidebarMenu>
            @for (source of items; track source.key) {
              <li hlmSidebarMenuItem>
                <a
                  hlmSidebarMenuButton
                  [isActive]="source.isActive()"
                  [routerLink]="source.key === 'pnc' ? ['/'] : ['/', source.key]"
                >
                  <ng-icon [name]="source.options.icon" />
                  <span>{{ source.options.name }}</span>
                </a>
              </li>
            }
          </ul>
        </div>
      </div>
    </div>
  `,
})
export default class AppSidebar {
  protected readonly registry = inject(SourceRegistry);
  protected items = [this.registry.get('pnc')!, ...this.registry.leaves];
}
