import type {BooleanInput} from '@angular/cdk/coercion';
import {booleanAttribute, ChangeDetectionStrategy, Component, computed, input} from '@angular/core';
import type {RouterLink} from '@angular/router';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideChevronRight} from '@ng-icons/lucide';
import type {ButtonVariants} from '@spartan-ng/helm/button';
import {hlm} from '@spartan-ng/helm/utils';
import type {ClassValue} from 'clsx';
import {HlmPaginationLink} from './hlm-pagination-link';

@Component({
  selector: 'hlm-pagination-next',
  imports: [HlmPaginationLink, NgIcon],
  providers: [provideIcons({lucideChevronRight})],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      hlmPaginationLink
      [attr.aria-label]="ariaLabel()"
      [class]="_computedClass()"
      [link]="link()"
      [queryParams]="queryParams()"
      [queryParamsHandling]="queryParamsHandling()"
      [size]="_size()"
    >
      <span [class]="_labelClass()">{{ text() }}</span>
      <ng-icon class="rtl:rotate-180" name="lucideChevronRight" />
    </a>
  `,
})
export class HlmPaginationNext {
  readonly userClass = input<ClassValue>('', {alias: 'class'});
  /** The link to navigate to the next page. */
  readonly link = input<RouterLink['routerLink']>();
  /** The query parameters to pass to the next page. */
  readonly queryParams = input<RouterLink['queryParams']>();
  /** How to handle query parameters when navigating to the next page. */
  readonly queryParamsHandling = input<RouterLink['queryParamsHandling']>();

  /** The aria-label for the next page link. */
  readonly ariaLabel = input<string>('Go to next page', {alias: 'aria-label'});
  /** The text to display for the next page link. */
  readonly text = input<string>('Next');
  /** Whether the button should only display the icon. */
  readonly iconOnly = input<boolean, BooleanInput>(false, {
    transform: booleanAttribute,
  });
  protected readonly _labelClass = computed(() => (this.iconOnly() ? 'sr-only' : 'hidden sm:block'));

  protected readonly _size = computed<ButtonVariants['size']>(() => (this.iconOnly() ? 'icon' : 'default'));

  protected readonly _computedClass = computed(() => hlm(!this.iconOnly() && 'pe-2!', this.userClass()));
}
