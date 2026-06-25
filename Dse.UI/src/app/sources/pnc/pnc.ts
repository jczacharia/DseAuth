import {Source} from '#core/source/source';
import {Service} from '@angular/core';

@Service()
export default class Pnc extends Source {
  constructor() {
    super('pnc', {
      name: 'PNC',
      summary: 'Brilliantly Boring',
      description: 'PNC Financial Services Group, Inc.',
      icon: 'pnc_logo',
      color: '#F58025',
      members: ['confluence', 'jira'],
    });
  }
}
