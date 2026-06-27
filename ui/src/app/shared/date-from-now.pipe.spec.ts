import {DateFromNowPipe} from '#shared/date-from-now.pipe';
import {render, screen} from '@testing-library/angular';
import {describe, expect, it} from 'vitest';

type Value = Parameters<DateFromNowPipe['transform']>[0];

describe(DateFromNowPipe.name, () => {
  // Fixed reference so every case is deterministic — native Temporal.Now is not
  // controlled by vitest's fake timers, so we inject `now` instead of mocking it.
  const NOW = Temporal.Instant.from('2026-06-15T12:00:00Z');
  const NOW_UTC = NOW.toZonedDateTimeISO('UTC');

  async function textFor(value: Value, now: Temporal.Instant | undefined = NOW): Promise<string> {
    await render(`<span data-testid="out">{{ value | dateFromNow: now }}</span>`, {
      imports: [DateFromNowPipe],
      componentProperties: {value, now},
    });
    return screen.getByTestId('out').textContent ?? '';
  }

  describe('empty input', () => {
    it('renders an empty string for null', async () => {
      expect(await textFor(null)).toBe('');
    });

    it('renders an empty string for undefined', async () => {
      expect(await textFor(undefined)).toBe('');
    });

    it('renders an empty string for an empty string', async () => {
      expect(await textFor('')).toBe('');
    });
  });

  describe('Temporal.Instant input', () => {
    it('suffixes a past instant with "ago"', async () => {
      expect(await textFor(NOW.subtract({minutes: 5}))).toBe('5 minutes ago');
    });

    it('prefixes a future instant with "in"', async () => {
      expect(await textFor(NOW.add({minutes: 10}))).toBe('in 10 minutes');
    });

    it('picks the largest elapsed unit', async () => {
      expect(await textFor(NOW.subtract({hours: 2}))).toBe('2 hours ago');
    });

    it('renders "now" for the current instant', async () => {
      expect(await textFor(NOW)).toBe('now');
    });
  });

  describe('string and Date inputs', () => {
    it('accepts an ISO string', async () => {
      expect(await textFor(NOW.subtract({hours: 2}).toString())).toBe('2 hours ago');
    });

    it('accepts a legacy Date via toTemporalInstant()', async () => {
      expect(await textFor(new Date(NOW.epochMilliseconds - 60 * 60 * 1000))).toBe('1 hour ago');
    });
  });

  describe('rounding (half-expand, like formatDistanceToNowStrict)', () => {
    it('rounds up at the half boundary', async () => {
      // 110s = 1.83 min → 2
      expect(await textFor(NOW.subtract({seconds: 110}))).toBe('2 minutes ago');
    });

    it('rounds down below the half boundary', async () => {
      // 80s = 1.33 min → 1
      expect(await textFor(NOW.subtract({seconds: 80}))).toBe('1 minute ago');
    });
  });

  describe('numeric: "auto" idioms', () => {
    it('renders "yesterday" instead of "1 day ago"', async () => {
      expect(await textFor(NOW_UTC.subtract({days: 1}).toInstant())).toBe('yesterday');
    });

    it('renders "last month" instead of "1 month ago"', async () => {
      expect(await textFor(NOW_UTC.subtract({months: 1}).toInstant())).toBe('last month');
    });

    it('stays numeric beyond a single unit', async () => {
      expect(await textFor(NOW_UTC.subtract({months: 2}).toInstant())).toBe('2 months ago');
    });
  });

  it('defaults `now` to the system clock when omitted', async () => {
    // No injected `now`: a long-past instant is unambiguously "years ago".
    expect(await textFor(Temporal.Instant.from('2020-01-01T00:00:00Z'), undefined)).toMatch(/years ago$/);
  });
});
