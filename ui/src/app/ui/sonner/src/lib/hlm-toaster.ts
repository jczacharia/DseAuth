import type {BooleanInput, NumberInput} from '@angular/cdk/coercion';
import {ChangeDetectionStrategy, Component, booleanAttribute, computed, input, numberAttribute} from '@angular/core';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideCircleCheck, lucideInfo, lucideLoader2, lucideOctagonX, lucideTriangleAlert} from '@ng-icons/lucide';
import {BrnSonnerImports, type ToasterProps} from '@spartan-ng/brain/sonner';
import {hlm} from '@spartan-ng/helm/utils';
import type {ClassValue} from 'clsx';

@Component({
  selector: 'hlm-toaster',
  imports: [BrnSonnerImports, NgIcon],
  providers: [provideIcons({lucideCircleCheck, lucideInfo, lucideTriangleAlert, lucideOctagonX, lucideLoader2})],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <brn-sonner-toaster
      [class]="_computedClass()"
      [closeButton]="closeButton()"
      [duration]="duration()"
      [expand]="expand()"
      [hotKey]="hotKey()"
      [invert]="invert()"
      [offset]="offset()"
      [position]="position()"
      [richColors]="richColors()"
      [style]="userStyle()"
      [theme]="theme()"
      [toastOptions]="_computedToastOptions()"
      [visibleToasts]="visibleToasts()"
    >
      <ng-template #loadingIcon>
        <ng-icon class="overflow-visible! text-base [&>svg]:motion-safe:animate-spin" name="lucideLoader2" />
      </ng-template>
      <ng-template #successIcon>
        <ng-icon class="overflow-visible! text-base" name="lucideCircleCheck" />
      </ng-template>
      <ng-template #errorIcon>
        <ng-icon class="overflow-visible! text-base" name="lucideOctagonX" />
      </ng-template>
      <ng-template #infoIcon>
        <ng-icon class="overflow-visible! text-base" name="lucideInfo" />
      </ng-template>
      <ng-template #warningIcon>
        <ng-icon class="overflow-visible! text-base" name="lucideTriangleAlert" />
      </ng-template>
    </brn-sonner-toaster>
  `,
})
export class HlmToaster {
  readonly invert = input<ToasterProps['invert'], BooleanInput>(false, {
    transform: booleanAttribute,
  });
  readonly theme = input<ToasterProps['theme']>('light');
  readonly position = input<ToasterProps['position']>('bottom-right');
  readonly hotKey = input<ToasterProps['hotkey']>(['altKey', 'KeyT']);
  readonly richColors = input<ToasterProps['richColors'], BooleanInput>(false, {
    transform: booleanAttribute,
  });
  readonly expand = input<ToasterProps['expand'], BooleanInput>(false, {
    transform: booleanAttribute,
  });
  readonly duration = input<ToasterProps['duration'], NumberInput>(4000, {
    transform: numberAttribute,
  });
  readonly visibleToasts = input<ToasterProps['visibleToasts'], NumberInput>(3, {
    transform: numberAttribute,
  });
  readonly closeButton = input<ToasterProps['closeButton'], BooleanInput>(false, {
    transform: booleanAttribute,
  });
  readonly toastOptions = input<ToasterProps['toastOptions']>({});

  protected readonly _computedToastOptions = computed(() => {
    const options = this.toastOptions();
    return {
      ...options,
      classes: {
        ...options?.classes,
        toast: hlm('rounded-2xl!', options?.classes?.toast),
      },
    };
  });
  readonly offset = input<ToasterProps['offset']>(null);
  readonly userClass = input<ClassValue>('', {alias: 'class'});
  readonly userStyle = input<Record<string, string>>(
    {
      '--normal-bg': 'var(--popover)',
      '--normal-text': 'var(--popover-foreground)',
      '--normal-border': 'var(--border)',
      '--border-radius': 'var(--radius)',
    },
    {alias: 'style'},
  );

  protected readonly _computedClass = computed(() => hlm('toaster group', this.userClass()));
}
