/** Separator between the parts of a hardware spec value, e.g. "CPU · 14C". */
const SPEC_SEPARATOR = ' · ';

/**
 * Splits a spec value into the lines it should wrap at. In narrow terminal
 * cards a long value would otherwise break mid-phrase; breaking at the dots
 * instead (and dropping them) keeps every part readable.
 */
export function specLines(value: string): string[] {
  return value
    .split(SPEC_SEPARATOR)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}
