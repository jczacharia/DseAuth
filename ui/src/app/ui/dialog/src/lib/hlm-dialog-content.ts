import type {BooleanInput} from '@angular/cdk/coercion';
import type {ComponentType} from '@angular/cdk/portal';
import {NgComponentOutlet} from '@angular/common';
import {booleanAttribute, ChangeDetectionStrategy, Component, computed, inject, input} from '@angular/core';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideX} from '@ng-icons/lucide';
import {BrnDialogRef, injectBrnDialogContext} from '@spartan-ng/brain/dialog';
import {HlmButton} from '@spartan-ng/helm/button';

import {classes} from '@spartan-ng/helm/utils';
import {HlmDialogClose} from './hlm-dialog-close';

interface HlmDialogContentContext {
  $component?: ComponentType<unknown>;
  $dynamicComponentClass?: string;
  $showCloseButton?: boolean;
}

@Component({
  selector: 'hlm-dialog-content',
  imports: [NgComponentOutlet, HlmButton, HlmDialogClose, NgIcon],
  providers: [provideIcons({lucideX})],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-slot': 'dialog-content',
    '[attr.data-state]': 'state()',
  },
  template: `
    @if (component) {
      <ng-container [ngComponentOutlet]="component" />
    } @else {
      <ng-content />
    }

    @if (showCloseButton()) {
      <button class="absolute end-4 top-4" hlmBtn hlmDialogClose size="icon-sm" variant="ghost">
        <span class="sr-only">close</span>
        <ng-icon name="lucideX" />
      </button>
    }
  `,
})
export class HlmDialogContent {
  private readonly _dialogRef = inject(BrnDialogRef);
  private readonly _dialogContext = injectBrnDialogContext<HlmDialogContentContext | null>({optional: true});

  readonly showCloseButton = input<boolean, BooleanInput>(this._dialogContext?.$showCloseButton ?? true, {
    transform: booleanAttribute,
  });

  readonly state = computed(() => this._dialogRef?.state() ?? 'closed');

  readonly component = this._dialogContext?.$component;
  private readonly _dynamicComponentClass = this._dialogContext?.$dynamicComponentClass;

  constructor() {
    classes(() => [
      'bg-popover text-popover-foreground data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 ring-foreground/10 relative mx-auto grid w-full max-w-[calc(100%-2rem)] gap-6 rounded-xl p-6 text-sm ring-1 duration-100 outline-none sm:mx-0 sm:max-w-md',
      this._dynamicComponentClass,
    ]);
  }
}
