import type { Locale } from '../i18n';

/** month is 1-based (1 = January), matching how humans write dates in data files. */
export interface YearMonth {
  year: number;
  month?: number;
}

const RANGE_SEPARATOR = ' – ';
const JS_MONTH_OFFSET = 1;

/** Intl sometimes emits no-break/narrow spaces; normalize so output and tests are stable. */
function normalizeSpaces(value: string): string {
  return value.replace(/\s/gu, ' ');
}

export function formatYearMonth(
  locale: Locale,
  { year, month }: YearMonth,
): string {
  if (month === undefined) {
    return String(year);
  }
  const date = new Date(Date.UTC(year, month - JS_MONTH_OFFSET));
  const formatted = new Intl.DateTimeFormat(locale, {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
  return normalizeSpaces(formatted);
}

export function formatPeriod(
  locale: Locale,
  from: YearMonth,
  to: YearMonth | undefined,
  presentLabel: string,
): string {
  const start = formatYearMonth(locale, from);
  if (to === undefined) {
    return `${start}${RANGE_SEPARATOR}${presentLabel}`;
  }
  const end = formatYearMonth(locale, to);
  if (start === end) {
    return start;
  }
  return `${start}${RANGE_SEPARATOR}${end}`;
}
