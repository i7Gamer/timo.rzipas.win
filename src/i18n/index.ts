import localeList from './locales.json';
import { ui, type UIKey } from './ui';

export type Locale = 'en' | 'de';
export type { UIKey };
export { ui };

// locales.json is the single source of truth, shared with scripts/*.mjs and astro.config.ts.
export const LOCALES = localeList as readonly Locale[];
export const DEFAULT_LOCALE: Locale = LOCALES[0];

export { LANG_COOKIE_NAME, LANG_COOKIE_MAX_AGE_SECONDS } from './cookie';

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
  );
}

export function resolveLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** The locale this build is being rendered for (set per `astro build` pass). */
export function getLocale(): Locale {
  return resolveLocale(import.meta.env.SITE_LOCALE);
}

type Dictionaries = { [L in Locale]: Partial<Record<string, string>> };

export function translate(
  dictionaries: Dictionaries,
  locale: Locale,
  key: string,
): string {
  return dictionaries[locale][key] ?? dictionaries[DEFAULT_LOCALE][key] ?? key;
}

export function t(locale: Locale, key: UIKey): string {
  return translate(ui, locale, key);
}

/** A value with an English original and optional translations. */
export type Localized<T> = { en: T } & Partial<
  Record<Exclude<Locale, 'en'>, T>
>;

export function pick<T>(locale: Locale, localized: Localized<T>): T {
  return localized[locale] ?? localized.en;
}

/** The locale a LanguageSwitcher on a page of `locale` should switch to. */
export function nextLocale(locale: Locale): Locale {
  const index = LOCALES.indexOf(locale);
  return LOCALES[(index + 1) % LOCALES.length];
}
