import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideChevronDown} from '@ng-icons/lucide';
import {BrnComboboxAnchor, BrnComboboxPopoverTrigger, BrnComboboxTrigger} from '@spartan-ng/brain/combobox';
import {BrnFieldControlDescribedBy} from '@spartan-ng/brain/field';
import {type ButtonVariants, HlmButton} from '@spartan-ng/helm/button';
import {hlm} from '@spartan-ng/helm/utils';
import type {ClassValue} from 'clsx';

@Component({
  selector: 'hlm-combobox-trigger',
  imports: [
    NgIcon,
    HlmButton,
    BrnComboboxAnchor,
    BrnComboboxTrigger,
    BrnComboboxPopoverTrigger,
    BrnFieldControlDescribedBy,
  ],
  providers: [provideIcons({lucideChevronDown})],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      brnComboboxAnchor
      brnComboboxPopoverTrigger
      brnComboboxTrigger
      brnFieldControlDescribedBy
      data-slot="combobox-trigger"
      hlmBtn
      [class]="_computedClass()"
      [id]="buttonId()"
      [variant]="variant()"
    >
      <ng-content />
      <ng-icon class="text-muted-foreground text-[length:--spacing(4)]" name="lucideChevronDown" />
    </button>
  `,
})
export class HlmComboboxTrigger {
  private static _id = 0;

  readonly userClass = input<ClassValue>('', {
    alias: 'class',
  });
  protected readonly _computedClass = computed(() => hlm('data-placeholder:text-muted-foreground', this.userClass()));

  readonly buttonId = input<string>(`hlm-combobox-trigger-${HlmComboboxTrigger._id++}`);

  readonly variant = input<ButtonVariants['variant']>('outline');
}
