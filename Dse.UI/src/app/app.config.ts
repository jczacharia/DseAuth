import {client} from '#api/client.gen';
import {provideHeyApiClient} from '#api/client/client.gen';
import {Source} from '#core/source/source';
import {SourceRegistry} from '#core/source/source-registry';
import {createPageTitle} from '#core/state/page-title';
import {Theme} from '#core/theme/theme';
import Confluence from '#sources/confluence/confluence';
import Jira from '#sources/jira/jira';
import Pnc from '#sources/pnc/pnc';
import {HttpClient, provideHttpClient} from '@angular/common/http';
import {
  ErrorHandler,
  inject,
  provideBrowserGlobalErrorListeners,
  provideEnvironmentInitializer,
  type ApplicationConfig,
  type Type,
} from '@angular/core';
import {
  provideRouter,
  RouteReuseStrategy,
  withComponentInputBinding,
  withExperimentalAutoCleanupInjectors,
  withInMemoryScrolling,
  withRouterConfig,
  type Route,
} from '@angular/router';
import {provideNgIconLoader} from '@ng-icons/core';
import {AppErrorHandler} from './app-error-handler';
import {AppReuseStrategy} from './app-reuse-strategy';

const sources: Type<Source>[] = [Pnc, Confluence, Jira];

export const appConfig: ApplicationConfig = {
  providers: [
    {provide: ErrorHandler, useExisting: AppErrorHandler},
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideHeyApiClient(client),
    provideEnvironmentInitializer(() => inject(Theme)),
    {provide: RouteReuseStrategy, useClass: AppReuseStrategy},
    provideNgIconLoader((name) => inject(HttpClient).get(`${name}.svg`, {responseType: 'text'})),
    SourceRegistry.provide(sources),
    provideRouter(
      [
        {
          path: '',
          loadComponent: () => import('./app-shell'),
          children: [
            {
              path: '',
              children: [
                {path: '', outlet: 'sidebar', loadComponent: () => import('./app-sidebar')},
                {
                  path: '',
                  pathMatch: 'full',
                  providers: [{provide: Source, useExisting: Pnc}],
                  loadComponent: () => import('#features/source/source-page'),
                },
              ],
            },
            {path: 'pnc', redirectTo: '', pathMatch: 'full'},
            ...sources.map((source) => routeSource(source)),
          ],
        },
        {path: '**', redirectTo: '', pathMatch: 'full'},
      ],
      withComponentInputBinding(),
      withExperimentalAutoCleanupInjectors(),
      withInMemoryScrolling({anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled'}),
      withRouterConfig({defaultQueryParamsHandling: 'merge', paramsInheritanceStrategy: 'always'}),
    ),
  ],
};

function routeSource(sourceType: Type<Source>): Route {
  return {
    path: '',
    loadChildren: () => {
      const source = inject(sourceType);
      return [routeSourceChild(source)];
    },
  };
}

function routeSourceChild(source: Source): Route {
  return {
    path: source.key,
    data: {source},
    providers: [{provide: Source, useValue: source}],
    title: () => createPageTitle(source.options.name),
    children: [
      {path: '', loadComponent: () => import('#features/source/source-page')},
      {path: '', outlet: 'sidebar', loadComponent: () => import('#features/source/source-sidebar')},
      {path: 'home', outlet: 'sidebar', loadComponent: () => import('./app-sidebar')},
    ],
  };
}
