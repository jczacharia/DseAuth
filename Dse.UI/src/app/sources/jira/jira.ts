import {Source, type SearchCard} from '#core/source/source';
import {Lazy} from '#shared/lazy';
import {Service, type Type} from '@angular/core';

@Service()
export default class Jira extends Source {
  constructor() {
    super('jira', {
      name: 'Jira',
      summary: 'Issue Tracking',
      description: 'Web-based issue tracking and project management tool used at PNC.',
      icon: 'jira',
      color: 'oklch(0.5648 0.2334 264.73)',
      card: new Lazy(() => import('./jira-card').then((m) => m.default as Type<SearchCard>)),
    });
  }
}
