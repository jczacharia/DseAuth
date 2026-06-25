import SearchBar from '#features/search/search-bar';
import {Component} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {HlmSidebarImports} from '@spartan-ng/helm/sidebar';

@Component({
  selector: 'app-shell',
  imports: [HlmSidebarImports, RouterOutlet, SearchBar],
  template: `
    <div hlmSidebarWrapper>
      <hlm-sidebar>
        <router-outlet name="sidebar" />
      </hlm-sidebar>
      <main hlmSidebarInset>
        <header class="flex h-12 shrink-0 items-center gap-3 border-b px-3">
          <button hlmSidebarTrigger>sdsd</button>
          <search-bar class="max-w-2xl flex-1" />
        </header>
        <div class="flex flex-1 flex-col overflow-auto">
          <router-outlet />
        </div>
      </main>
    </div>
  `,
})
export default class AppShell {}
