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
  viewChild,
} from '@angular/core';
import {type ControlValueAccessor, NG_VALUE_ACCESSOR} from '@angular/forms';
import {BrnFieldControl, provideBrnLabelable} from '@spartan-ng/brain/field';
import type {ChangeFn, TouchFn} from '@spartan-ng/brain/forms';
import type {BrnOverlayState} from '@spartan-ng/brain/overlay';
import {BrnPopover} from '@spartan-ng/brain/popover';
import {HlmCalendar} from '@spartan-ng/helm/calendar';
import {HlmPopoverImports} from '@spartan-ng/helm/popover';
import {HlmDatePickerTriggerToken} from './hlm-date-picker-trigger.token';
import {type HlmDatePickerBase, injectHlmDatePickerConfig, provideHlmDatePicker} from './hlm-date-picker.token';

export const HLM_DATE_PICKER_VALUE_ACCESSOR = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => HlmDatePicker),
  multi: true,
};

@Component({
  selector: 'hlm-date-picker',
  imports: [HlmPopoverImports, HlmCalendar],
  providers: [HLM_DATE_PICKER_VALUE_ACCESSOR, provideHlmDatePicker(HlmDatePicker), provideBrnLabelable(HlmDatePicker)],
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [BrnFieldControl],
  host: {class: 'block'},
  template: `
    <hlm-popover sideOffset="5" [state]="_popoverState()" (stateChanged)="_onStateChange($event)">
      <ng-content />

      <hlm-popover-content *hlmPopoverPortal="let ctx" class="w-fit p-0">
        <ng-content select="[hlmDatePickerHeader]" />
        <hlm-calendar
          class="rounded-none border-0"
          [captionLayout]="captionLayout()"
          [date]="_mutableDate()"
          [defaultFocusedDate]="_mutableDate() ?? defaultFocusedDate()"
          [disabled]="_disabled()"
          [max]="max()"
          [min]="min()"
          (dateChange)="_handleChange($event)"
        />
        <ng-content select="[hlmDatePickerFooter]" />
      </hlm-popover-content>
    </hlm-popover>
  `,
})
export class HlmDatePicker<T> implements HlmDatePickerBase<T>, ControlValueAccessor {
  private readonly _config = injectHlmDatePickerConfig<T>();

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
  readonly date = input<T>();

  /** The date the calendar focuses on first open when no date is selected. */
  readonly defaultFocusedDate = input<T>();

  protected readonly _mutableDate = linkedSignal(this.date);

  /** If true, the date picker will close when a date is selected. */
  readonly autoCloseOnSelect = input<boolean, BooleanInput>(this._config.autoCloseOnSelect, {
    transform: booleanAttribute,
  });

  /** Defines how the date should be displayed in the UI.  */
  readonly formatDate = input<(date: T) => string>(this._config.formatDate);

  /** Defines how the date should be transformed before saving to model/form. */
  readonly transformDate = input<(date: T) => T>(this._config.transformDate);

  protected readonly _popoverState = signal<BrnOverlayState | null>(null);

  protected readonly _disabled = linkedSignal(this.disabled);

  /** @internal The disabled state as a readonly signal */
  readonly disabledState = this._disabled.asReadonly();

  readonly formattedDate = computed(() => {
    const date = this._mutableDate();
    return date ? this.formatDate()(date) : undefined;
  });

  readonly dateChange = output<T>();

  readonly labelableId = computed(() => this._trigger()?.triggerId());

  readonly hasDate = computed(() => !!this._mutableDate());

  protected _onChange?: ChangeFn<T>;
  protected _onTouched?: TouchFn;

  protected _onStateChange(state: BrnOverlayState) {
    this._popoverState.set(state);
    if (state === 'closed') this._onTouched?.();
  }

  protected _handleChange(value: T | undefined) {
    if (this._disabled()) return;
    this.updateDate(value);

    if (this.autoCloseOnSelect()) {
      this._popoverState.set('closed');
    }
  }

  /**
   * Commit a date to the picker. Updates the internal model, notifies form
   * controls, and emits `dateChange`. Unlike `_handleChange`, this does not
   * close the popover - it's intended to be called from a text input that
   * is parsing user-entered values while typing.
   */
  updateDate(value: T | undefined) {
    if (this._disabled()) return;
    const transformedDate = value !== undefined ? this.transformDate()(value) : undefined;

    this._mutableDate.set(transformedDate);
    this._onChange?.(transformedDate as T);
    this.dateChange.emit(transformedDate as T);
  }

  /** CONTROL VALUE ACCESSOR */
  writeValue(value: T | null): void {
    this._mutableDate.set(value ? this.transformDate()(value) : undefined);
  }

  registerOnChange(fn: ChangeFn<T>): void {
    this._onChange = fn;
  }

  registerOnTouched(fn: TouchFn): void {
    this._onTouched = fn;
  }

  touched(): void {
    this._onTouched?.();
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
    this._onChange?.(undefined as T);
    this.dateChange.emit(undefined as T);
  }
}
