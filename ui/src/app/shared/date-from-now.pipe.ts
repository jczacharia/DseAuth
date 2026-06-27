import type {PipeTransform} from '@angular/core';
import {Pipe} from '@angular/core';

// Largest → smallest, matching `formatDistanceToNowStrict`'s unit set (no weeks).
const UNITS = ['years', 'months', 'days', 'hours', 'minutes', 'seconds'] as const;

// Temporal.Duration field (plural) → Intl.RelativeTimeFormat unit (singular).
const INTL_UNIT: Record<(typeof UNITS)[number], Intl.RelativeTimeFormatUnit> = {
  years: 'year',
  months: 'month',
  days: 'day',
  hours: 'hour',
  minutes: 'minute',
  seconds: 'second',
};

const RELATIVE_TIME = new Intl.RelativeTimeFormat(undefined, {numeric: 'auto'});

@Pipe({name: 'dateFromNow'})
export class DateFromNowPipe implements PipeTransform {
  transform(
    value: Temporal.Instant | Date | string | null | undefined,
    now: Temporal.Instant = Temporal.Now.instant(),
  ): string {
    if (!value) return '';
    const zone = Temporal.Now.timeZoneId();
    const from = now.toZonedDateTimeISO(zone);

    const to =
      value instanceof Date
        ? value.toTemporalInstant().toZonedDateTimeISO(zone)
        : Temporal.Instant.from(value).toZonedDateTimeISO(zone);

    // Largest unit that actually elapsed; the duration's sign encodes past vs. future.
    const elapsed = from.until(to, {largestUnit: 'year'});
    const unit = UNITS.find((u) => elapsed[u] !== 0) ?? 'seconds';

    // Re-diff at that single unit so the value is rounded to nearest, not truncated.
    const amount = from.until(to, {largestUnit: unit, smallestUnit: unit, roundingMode: 'halfExpand'})[unit];
    return RELATIVE_TIME.format(amount, INTL_UNIT[unit]);
  }
}
