import type {BooleanInput, NumberInput} from '@angular/cdk/coercion';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  forwardRef,
  input,
  linkedSignal,
  numberAttribute,
  output,
  signal,
  viewChild,
} from '@angular/core';
import {type ControlValueAccessor, NG_VALUE_ACCESSOR} from '@angular/forms';
import {BrnFieldControl, provideBrnLabelable} from '@spartan-ng/brain/field';
import type {ChangeFn, TouchFn} from '@spartan-ng/brain/forms';
import type {BrnOverlayState} from '@spartan-ng/brain/overlay';
import {BrnPopover} from '@spartan-ng/brain/popover';
import {HlmCalendarMulti} from '@spartan-ng/helm/calendar';
import {HlmPopoverImports} from '@spartan-ng/helm/popover';
import {injectHlmDatePickerMultiConfig} from './hlm-date-picker-multi.token';
import {HlmDatePickerTriggerToken} from './hlm-date-picker-trigger.token';
import {type HlmDatePickerBase, provideHlmDatePicker} from './hlm-date-picker.token';

export const HLM_DATE_PICKER_MUTLI_VALUE_ACCESSOR = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => HlmDatePickerMulti),
  multi: true,
};

@Component({
  selector: 'hlm-date-picker-multi',
  imports: [HlmPopoverImports, HlmCalendarMulti],
  providers: [
    HLM_DATE_PICKER_MUTLI_VALUE_ACCESSOR,
    provideHlmDatePicker(HlmDatePickerMulti),
    provideBrnLabelable(HlmDatePickerMulti),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [BrnFieldControl],
  host: {class: 'block'},
  template: `
    <hlm-popover sideOffset="5" [state]="_popoverState()" (stateChanged)="_onStateChange($event)">
      <ng-content />

      <hlm-popover-content *hlmPopoverPortal="let ctx" class="w-fit p-0">
        <ng-content select="[hlmDatePickerHeader]" />
        <hlm-calendar-multi
          class="rounded-none border-0"
          [captionLayout]="captionLayout()"
          [date]="_mutableDate()"
          [disabled]="_disabled()"
          [max]="max()"
          [maxSelection]="maxSelection()"
          [min]="min()"
          [minSelection]="minSelection()"
          (dateChange)="_handleChange($event)"
        />
        <ng-content select="[hlmDatePickerFooter]" />
      </hlm-popover-content>
    </hlm-popover>
  `,
})
export class HlmDatePickerMulti<T> implements HlmDatePickerBase<T>, ControlValueAccessor {
  private readonly _config = injectHlmDatePickerMultiConfig<T>();

  readonly popover = viewChild.required(BrnPopover);

  private readonly _trigger = contentChild(HlmDatePickerTriggerToken);

  /** Show dropdowns to navigate between months or years. */
  readonly captionLayout = input<'dropdown' | 'label' | 'dropdown-months' | 'dropdown-years'>('label');

  /** The minimum date that can be selected.*/
  readonly min = input<T>();

  /** The maximum date that can be selected. */
  readonly max = input<T>();

  /** The minimum selectable dates.  */
  readonly minSelection = input<number, NumberInput>(undefined, {
    transform: numberAttribute,
  });

  /** The maximum selectable dates.  */
  readonly maxSelection = input<number, NumberInput>(undefined, {
    transform: numberAttribute,
  });

  /** Determine if the date picker is disabled. */
  readonly disabled = input<boolean, BooleanInput>(false, {
    transform: booleanAttribute,
  });

  /** The selected value. */
  readonly date = input<T[]>();

  protected readonly _mutableDate = linkedSignal(this.date);

  /** If true, the date picker will close when the max selection of dates is reached. */
  readonly autoCloseOnMaxSelection = input<boolean, BooleanInput>(this._config.autoCloseOnMaxSelection, {
    transform: booleanAttribute,
  });

  /** Defines how the date should be displayed in the UI.  */
  readonly formatDates = input<(date: T[]) => string>(this._config.formatDates);

  /** Defines how the date should be transformed before saving to model/form. */
  readonly transformDates = input<(date: T[]) => T[]>(this._config.transformDates);

  protected readonly _popoverState = signal<BrnOverlayState | null>(null);

  protected readonly _disabled = linkedSignal(this.disabled);

  /** @internal The disabled state as a readonly signal */
  readonly disabledState = this._disabled.asReadonly();

  readonly formattedDate = computed(() => {
    const dates = this._mutableDate();
    return dates ? this.formatDates()(dates) : undefined;
  });

  readonly dateChange = output<T[]>();

  readonly labelableId = computed(() => this._trigger()?.triggerId());

  readonly hasDate = computed(() => !!this._mutableDate()?.length);

  protected _onChange?: ChangeFn<T[]>;
  protected _onTouched?: TouchFn;

  protected _onStateChange(state: BrnOverlayState) {
    this._popoverState.set(state);
    if (state === 'closed') this._onTouched?.();
  }

  protected _handleChange(value: T[] | undefined) {
    if (value === undefined) return;

    if (this._disabled()) return;
    const transformedDate = value !== undefined ? this.transformDates()(value) : value;

    this._mutableDate.set(transformedDate);
    this._onChange?.(transformedDate);
    this.dateChange.emit(transformedDate);

    if (this.autoCloseOnMaxSelection() && this._mutableDate()?.length === this.maxSelection()) {
      this._popoverState.set('closed');
    }
  }

  /** CONTROL VALUE ACCESSOR */
  writeValue(value: T[] | null): void {
    this._mutableDate.set(value ? this.transformDates()(value) : undefined);
  }

  registerOnChange(fn: ChangeFn<T[]>): void {
    this._onChange = fn;
  }

  registerOnTouched(fn: TouchFn): void {
    this._onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this._disabled.set(isDisabled);
  }

  open() {
    this._popoverState.set('open');
  }

  close() {
    this._popoverState.set('closed');
  }

  reset() {
    this._mutableDate.set(undefined);
    this._onChange?.([]);
    this.dateChange.emit([]);
  }
}
