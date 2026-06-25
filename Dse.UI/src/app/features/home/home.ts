import {Component} from '@angular/core';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideArrowRight} from '@ng-icons/lucide';
import {HlmButton} from '@spartan-ng/helm/button';

// Living example of the spartan/ui starting blocks.
@Component({
  selector: 'dse-home',
  imports: [HlmButton, NgIcon],
  providers: [provideIcons({lucideArrowRight})],
  template: `
    <button hlmBtn>Primary</button>
    <button hlmBtn variant="secondary">Secondary</button>
    <button hlmBtn variant="outline">Outline</button>
    <button hlmBtn variant="ghost">Ghost</button>
    <button hlmBtn variant="destructive">Destructive</button>
    <button hlmBtn variant="link">Link</button>
    <button disabled hlmBtn>Disabled</button>
    <button hlmBtn>
      Next
      <ng-icon name="lucideArrowRight" />
    </button>
  `,
})
export default class Home {}
