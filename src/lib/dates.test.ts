import { describe, expect, it } from 'vitest';

import { formatPeriod, formatYearMonth } from './dates';

describe('formatYearMonth', () => {
  it('formats month and year for English', () => {
    expect(formatYearMonth('en', { year: 2018, month: 10 })).toBe('Oct 2018');
    expect(formatYearMonth('en', { year: 2019, month: 9 })).toBe('Sep 2019');
  });

  it('formats month and year for German', () => {
    expect(formatYearMonth('de', { year: 2018, month: 10 })).toBe('Okt. 2018');
    expect(formatYearMonth('de', { year: 2019, month: 9 })).toBe('Sept. 2019');
  });

  it('formats a year-only value without a month', () => {
    expect(formatYearMonth('en', { year: 2016 })).toBe('2016');
    expect(formatYearMonth('de', { year: 2016 })).toBe('2016');
  });

  it('handles the year boundaries January and December', () => {
    expect(formatYearMonth('en', { year: 2020, month: 1 })).toBe('Jan 2020');
    expect(formatYearMonth('en', { year: 2020, month: 12 })).toBe('Dec 2020');
  });
});

describe('formatPeriod', () => {
  it('joins two dates with an en dash', () => {
    expect(
      formatPeriod(
        'en',
        { year: 2018, month: 10 },
        { year: 2019, month: 8 },
        'today',
      ),
    ).toBe('Oct 2018 – Aug 2019');
  });

  it('uses the present label when there is no end date', () => {
    expect(
      formatPeriod('en', { year: 2019, month: 9 }, undefined, 'today'),
    ).toBe('Sep 2019 – today');
    expect(
      formatPeriod('de', { year: 2019, month: 9 }, undefined, 'heute'),
    ).toBe('Sept. 2019 – heute');
  });

  it('collapses identical start and end into a single date', () => {
    expect(
      formatPeriod(
        'en',
        { year: 2018, month: 8 },
        { year: 2018, month: 8 },
        'today',
      ),
    ).toBe('Aug 2018');
    expect(formatPeriod('en', { year: 2016 }, { year: 2016 }, 'today')).toBe(
      '2016',
    );
  });

  it('formats year-only periods', () => {
    expect(formatPeriod('en', { year: 2016 }, { year: 2018 }, 'today')).toBe(
      '2016 – 2018',
    );
  });
});
