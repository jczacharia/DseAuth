import {Source, type SearchCard} from '#core/source/source';
import {Lazy} from '#shared/lazy';
import {Service, type Type} from '@angular/core';

@Service()
export default class Confluence extends Source {
  constructor() {
    super('confluence', {
      name: 'Confluence',
      summary: 'Collaboration Tool',
      description: 'Web-based collaboration tool used at PNC to share information.',
      icon: 'confluence',
      color: 'oklch(0.5648 0.2334 246)',
      card: new Lazy(() => import('./confluence-card').then((m) => m.default as Type<SearchCard>)),
    });
  }
}
