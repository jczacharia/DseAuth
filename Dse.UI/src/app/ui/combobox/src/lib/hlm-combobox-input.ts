import {type BooleanInput} from '@angular/cdk/coercion';
import {booleanAttribute, ChangeDetectionStrategy, Component, input} from '@angular/core';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideChevronDown, lucideX} from '@ng-icons/lucide';
import {BrnComboboxAnchor, BrnComboboxImports, BrnComboboxPopoverTrigger} from '@spartan-ng/brain/combobox';
import {HlmInputGroup, HlmInputGroupImports} from '@spartan-ng/helm/input-group';
import {classes} from '@spartan-ng/helm/utils';

@Component({
  selector: 'hlm-combobox-input',
  imports: [HlmInputGroupImports, NgIcon, BrnComboboxImports, BrnComboboxPopoverTrigger],
  providers: [provideIcons({lucideChevronDown, lucideX})],
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [BrnComboboxAnchor, HlmInputGroup],
  template: `
    <input
      #comboboxInput="brnComboboxInput"
      brnComboboxInput
      brnComboboxPopoverTrigger
      hlmInputGroupInput
      [aria-invalid]="ariaInvalidOverride()"
      [closeOnTriggerClick]="false"
      [forceInvalid]="forceInvalid()"
      [id]="inputId()"
      [placeholder]="placeholder()"
    />

    <hlm-input-group-addon align="inline-end">
      @if (showTrigger()) {
        <button
          brnComboboxPopoverTrigger
          class="group-has-data-[slot=combobox-clear]/input-group:hidden data-pressed:bg-transparent"
          data-slot="input-group-button"
          hlmInputGroupButton
          size="icon-xs"
          variant="ghost"
          [disabled]="comboboxInput.disabled()"
        >
          <ng-icon name="lucideChevronDown" />
        </button>
      }

      @if (showClear()) {
        <button
          *brnComboboxClear
          data-slot="combobox-clear"
          hlmInputGroupButton
          size="icon-xs"
          variant="ghost"
          [disabled]="comboboxInput.disabled()"
        >
          <ng-icon name="lucideX" />
        </button>
      }
    </hlm-input-group-addon>

    <ng-content />
  `,
})
export class HlmComboboxInput {
  private static _id = 0;

  readonly inputId = input<string>(`hlm-combobox-input-${HlmComboboxInput._id++}`);
  readonly placeholder = input<string>('');

  readonly showTrigger = input<boolean, BooleanInput>(true, {transform: booleanAttribute});
  readonly showClear = input<boolean, BooleanInput>(false, {transform: booleanAttribute});
  readonly forceInvalid = input<boolean, BooleanInput>(false, {transform: booleanAttribute});

  /** Manual override for aria-invalid. When not set, auto-detects from the parent combobox error state. */
  readonly ariaInvalidOverride = input<boolean | undefined, BooleanInput>(undefined, {
    transform: (v: BooleanInput) => (v === '' || v === undefined ? undefined : booleanAttribute(v)),
    alias: 'aria-invalid',
  });

  constructor() {
    classes(() => 'w-auto');
  }
}
