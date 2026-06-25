import type {BooleanInput} from '@angular/cdk/coercion';
import {booleanAttribute, ChangeDetectionStrategy, Component, computed, input} from '@angular/core';
import type {RouterLink} from '@angular/router';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideChevronLeft} from '@ng-icons/lucide';
import type {ButtonVariants} from '@spartan-ng/helm/button';
import {hlm} from '@spartan-ng/helm/utils';
import type {ClassValue} from 'clsx';
import {HlmPaginationLink} from './hlm-pagination-link';

@Component({
  selector: 'hlm-pagination-previous',
  imports: [HlmPaginationLink, NgIcon],
  providers: [provideIcons({lucideChevronLeft})],
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
      <ng-icon class="rtl:rotate-180" name="lucideChevronLeft" />
      <span [class]="_labelClass()">{{ text() }}</span>
    </a>
  `,
})
export class HlmPaginationPrevious {
  readonly userClass = input<ClassValue>('', {alias: 'class'});
  /** The link to navigate to the previous page. */
  readonly link = input<RouterLink['routerLink']>();
  /** The query parameters to pass to the previous page. */
  readonly queryParams = input<RouterLink['queryParams']>();
  /** How to handle query parameters when navigating to the previous page. */
  readonly queryParamsHandling = input<RouterLink['queryParamsHandling']>();

  /** The aria-label for the previous page link. */
  readonly ariaLabel = input<string>('Go to previous page', {alias: 'aria-label'});
  /** The text to display for the previous page link. */
  readonly text = input<string>('Previous');
  /** Whether the button should only display the icon. */
  readonly iconOnly = input<boolean, BooleanInput>(false, {
    transform: booleanAttribute,
  });
  protected readonly _labelClass = computed(() => hlm(this.iconOnly() ? 'sr-only' : 'hidden sm:block'));

  protected readonly _size = computed<ButtonVariants['size']>(() => (this.iconOnly() ? 'icon' : 'default'));

  protected readonly _computedClass = computed(() => hlm(!this.iconOnly() && 'ps-2!', this.userClass()));
}
