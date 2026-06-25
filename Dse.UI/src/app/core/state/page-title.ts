import {linkedSignal} from '@angular/core';
import {title} from '@signality/core';

const SUFFIX = 'Enterprise Search';

export function createPageTitle(...values: (string | undefined | null)[]) {
  let gen = SUFFIX;
  for (let val of [...values].reverse()) {
    val = val?.trim();
    if (val) gen = `${val} - ${gen}`;
  }
  return gen;
}

export function pageTitle(...values: (string | undefined | null)[]) {
  return linkedSignal(title(), {set: (value, set) => set(createPageTitle(value, ...values))});
}
