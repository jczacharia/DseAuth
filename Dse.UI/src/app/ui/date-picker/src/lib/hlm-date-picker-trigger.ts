import {type BooleanInput} from '@angular/cdk/coercion';
import {booleanAttribute, ChangeDetectionStrategy, Component, computed, inject, input} from '@angular/core';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideChevronDown} from '@ng-icons/lucide';
import {BrnFieldControl, BrnFieldControlDescribedBy} from '@spartan-ng/brain/field';
import {type ButtonVariants, HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmPopoverTrigger} from '@spartan-ng/helm/popover';
import {hlm} from '@spartan-ng/helm/utils';
import {type ClassValue} from 'clsx';
import {type HlmDatePickerTriggerBase, provideHlmDatePickerTrigger} from './hlm-date-picker-trigger.token';
import {injectHlmDatePicker} from './hlm-date-picker.token';

@Component({
  selector: 'hlm-date-picker-trigger',
  imports: [HlmButtonImports, HlmPopoverTrigger, NgIcon, BrnFieldControlDescribedBy],
  providers: [provideIcons({lucideChevronDown}), provideHlmDatePickerTrigger(HlmDatePickerTrigger)],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {'data-slot': 'date-picker-trigger'},
  template: `
    <button
      brnFieldControlDescribedBy
      hlmBtn
      hlmPopoverTrigger
      type="button"
      [attr.aria-invalid]="_ariaInvalid()"
      [attr.data-dirty]="_dirty?.() ? 'true' : null"
      [attr.data-invalid]="_ariaInvalid()"
      [attr.data-matches-spartan-invalid]="_spartanInvalid() ? 'true' : null"
      [attr.data-placeholder]="_isPlaceholder() ? '' : null"
      [attr.data-touched]="_touched?.() ? 'true' : null"
      [class]="_computedClass()"
      [disabled]="_disabled()"
      [hlmPopoverTriggerFor]="_popover()"
      [id]="buttonId()"
      [variant]="variant()"
    >
      <span class="truncate">
        @if (_formattedDate(); as formattedDate) {
          {{ formattedDate }}
        } @else {
          <ng-content />
        }
      </span>

      @if (showTrigger()) {
        <ng-icon name="lucideChevronDown" />
      }
    </button>
  `,
})
export class HlmDatePickerTrigger implements HlmDatePickerTriggerBase {
  private static _nextId = 0;

  private readonly _fieldControl = inject(BrnFieldControl, {optional: true});
  private readonly _datePicker = injectHlmDatePicker();

  private readonly _invalid = this._fieldControl?.invalid;
  protected readonly _spartanInvalid = computed(() => this.forceInvalid() || this._fieldControl?.spartanInvalid());
  protected readonly _dirty = this._fieldControl?.dirty;
  protected readonly _touched = this._fieldControl?.touched;

  protected readonly _ariaInvalid = computed(() => (this._invalid?.() ? 'true' : null));

  readonly userClass = input<ClassValue>('', {alias: 'class'});
  protected readonly _computedClass = computed(() =>
    hlm('data-placeholder:text-muted-foreground justify-between', this.userClass()),
  );

  protected readonly _isPlaceholder = computed(() => !this._datePicker.hasDate());

  /** The id of the button that opens the date picker. */
  readonly buttonId = input<string>(`hlm-date-picker-${++HlmDatePickerTrigger._nextId}`);

  /** @internal The id of the button that opens the date picker, used for labeling. */
  readonly triggerId = this.buttonId;

  /** Forces the invalid state visually, regardless of form control state. */
  readonly forceInvalid = input<boolean, BooleanInput>(false, {transform: booleanAttribute});

  readonly variant = input<ButtonVariants['variant']>('outline');

  readonly showTrigger = input<boolean, BooleanInput>(true, {transform: booleanAttribute});

  protected readonly _popover = this._datePicker.popover;
  protected readonly _disabled = this._datePicker.disabledState;
  protected readonly _formattedDate = this._datePicker.formattedDate;
}
