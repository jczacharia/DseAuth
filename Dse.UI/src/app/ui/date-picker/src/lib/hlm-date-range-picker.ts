import type {BooleanInput} from '@angular/cdk/coercion';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  forwardRef,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import {type ControlValueAccessor, NG_VALUE_ACCESSOR} from '@angular/forms';
import {BrnFieldControl, provideBrnLabelable} from '@spartan-ng/brain/field';
import type {ChangeFn, TouchFn} from '@spartan-ng/brain/forms';
import type {BrnOverlayState} from '@spartan-ng/brain/overlay';
import {BrnPopover} from '@spartan-ng/brain/popover';
import {HlmCalendarRange} from '@spartan-ng/helm/calendar';
import {HlmPopoverImports} from '@spartan-ng/helm/popover';
import {HlmDatePickerTriggerToken} from './hlm-date-picker-trigger.token';
import {type HlmDatePickerBase, provideHlmDatePicker} from './hlm-date-picker.token';
import {injectHlmDateRangePickerConfig} from './hlm-date-range-picker.token';

export const HLM_DATE_RANGE_PICKER_VALUE_ACCESSOR = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => HlmDateRangePicker),
  multi: true,
};

@Component({
  selector: 'hlm-date-range-picker',
  imports: [HlmPopoverImports, HlmCalendarRange],
  providers: [
    HLM_DATE_RANGE_PICKER_VALUE_ACCESSOR,
    provideHlmDatePicker(HlmDateRangePicker),
    provideBrnLabelable(HlmDateRangePicker),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [BrnFieldControl],
  host: {class: 'block'},
  template: `
    <hlm-popover sideOffset="5" [state]="_popoverState()" (stateChanged)="_onStateChange($event)">
      <ng-content />

      <hlm-popover-content *hlmPopoverPortal="let ctx" class="w-fit p-0">
        <ng-content select="[hlmDatePickerHeader]" />
        <hlm-calendar-range
          class="rounded-none border-0"
          [captionLayout]="captionLayout()"
          [disabled]="_disabled()"
          [endDate]="_end()"
          [max]="max()"
          [min]="min()"
          [startDate]="_start()"
          (endDateChange)="_handleEndDateChange($event)"
          (startDateChange)="_handleStartDayChange($event)"
        />
        <ng-content select="[hlmDatePickerFooter]" />
      </hlm-popover-content>
    </hlm-popover>
  `,
})
export class HlmDateRangePicker<T> implements HlmDatePickerBase<T>, ControlValueAccessor {
  private readonly _config = injectHlmDateRangePickerConfig<T>();

  readonly popover = viewChild.required(BrnPopover);

  private readonly _trigger = contentChild(HlmDatePickerTriggerToken);

  /** Show dropdowns to navigate between months or years. */
  readonly captionLayout = input<'dropdown' | 'label' | 'dropdown-months' | 'dropdown-years'>('label');

  /** The minimum date that can be selected.*/
  readonly min = input<T>();

  /** The maximum date that can be selected. */
  readonly max = input<T>();

  /** Determine if the date picker is disabled. */
  readonly disabled = input<boolean, BooleanInput>(false, {
    transform: booleanAttribute,
  });

  /** The selected value. */
  readonly date = input<[T, T]>();

  protected readonly _mutableDate = linkedSignal(this.date);

  protected readonly _start = linkedSignal(() => this._mutableDate()?.[0]);
  protected readonly _end = linkedSignal(() => this._mutableDate()?.[1]);

  /** If true, the date picker will close when the end date is selected */
  readonly autoCloseOnEndSelection = input<boolean, BooleanInput>(this._config.autoCloseOnEndSelection, {
    transform: booleanAttribute,
  });

  /** Defines how the date should be displayed in the UI.  */
  readonly formatDates = input<(dates: [T | undefined, T | undefined]) => string>(this._config.formatDates);

  /** Defines how the date should be transformed before saving to model/form. */
  readonly transformDates = input<(date: [T, T]) => [T, T]>(this._config.transformDates);

  protected readonly _popoverState = signal<BrnOverlayState | null>(null);

  protected readonly _disabled = linkedSignal(this.disabled);

  /** @internal The disabled state as a readonly signal */
  readonly disabledState = this._disabled.asReadonly();

  readonly formattedDate = computed(() => {
    const start = this._start();
    const end = this._end();
    return start || end ? this.formatDates()([start, end]) : undefined;
  });

  readonly dateChange = output<[T, T] | null>();

  readonly labelableId = computed(() => this._trigger()?.triggerId());

  readonly hasDate = computed(() => !!this._start() || !!this._end());

  protected _onChange?: ChangeFn<[T, T] | null>;
  protected _onTouched?: TouchFn;

  protected _onStateChange(state: BrnOverlayState) {
    this._popoverState.set(state);
    if (state === 'closed') {
      this._onClose();
      this._onTouched?.();
    }
  }

  protected _handleStartDayChange(value: T | undefined) {
    this._start.set(value);
  }

  protected _handleEndDateChange(value: T | undefined): void {
    this._end.set(value);
    if (this._disabled()) return;

    const start = this._start();
    if (start && value) {
      const transformedDates = this.transformDates()([start, value]);
      this._mutableDate.set(transformedDates);
      this.dateChange.emit(transformedDates);
      this._onChange?.(transformedDates);

      if (this.autoCloseOnEndSelection()) {
        this._popoverState.set('closed');
      }
    }
  }

  /** CONTROL VALUE ACCESSOR */
  writeValue(value: [T, T] | null): void {
    untracked(() => {
      if (!value) {
        this._mutableDate.set(undefined);
      } else {
        this._mutableDate.set(this.transformDates()(value));
      }
    });
  }

  registerOnChange(fn: ChangeFn<[T, T] | null>): void {
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
    this._start.set(undefined);
    this._end.set(undefined);
    this._onChange?.(null);
    this.dateChange.emit(null);
  }

  protected _onClose(): void {
    const dates = this._mutableDate();
    if (this._start() && !this._end() && dates) {
      this._start.set(dates[0]);
      this._end.set(dates[1]);
    }
  }
}
