import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LOCALE,
  LOCALES,
  getLocale,
  isLocale,
  nextLocale,
  pick,
  resolveLocale,
  t,
  translate,
  ui,
  type Locale,
  type UIKey,
} from './index';

describe('LOCALES', () => {
  it('has English as the default (first) locale', () => {
    expect(DEFAULT_LOCALE).toBe('en');
    expect(LOCALES[0]).toBe(DEFAULT_LOCALE);
  });

  it('contains no duplicates', () => {
    expect(new Set(LOCALES).size).toBe(LOCALES.length);
  });
});

describe('isLocale', () => {
  it('accepts every supported locale', () => {
    for (const locale of LOCALES) {
      expect(isLocale(locale)).toBe(true);
    }
  });

  it('rejects unsupported language codes', () => {
    expect(isLocale('fr')).toBe(false);
    expect(isLocale('EN')).toBe(false);
  });

  it('rejects non-string values', () => {
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale(null)).toBe(false);
    expect(isLocale(42)).toBe(false);
    expect(isLocale('')).toBe(false);
  });
});

describe('resolveLocale', () => {
  it('passes through supported locales', () => {
    expect(resolveLocale('de')).toBe('de');
    expect(resolveLocale('en')).toBe('en');
  });

  it('falls back to the default locale for unsupported values', () => {
    expect(resolveLocale('fr')).toBe(DEFAULT_LOCALE);
    expect(resolveLocale(undefined)).toBe(DEFAULT_LOCALE);
    expect(resolveLocale('')).toBe(DEFAULT_LOCALE);
  });
});

describe('translate', () => {
  const dictionaries: Record<Locale, Record<string, string>> = {
    en: { greeting: 'hello', onlyEnglish: 'english only' },
    de: { greeting: 'hallo' },
  };

  it('returns the translation for the requested locale', () => {
    expect(translate(dictionaries, 'de', 'greeting')).toBe('hallo');
    expect(translate(dictionaries, 'en', 'greeting')).toBe('hello');
  });

  it('falls back to the default locale when the key is untranslated', () => {
    expect(translate(dictionaries, 'de', 'onlyEnglish')).toBe('english only');
  });

  it('echoes the key when it is missing in every locale', () => {
    expect(translate(dictionaries, 'de', 'missingEverywhere')).toBe(
      'missingEverywhere',
    );
    expect(translate(dictionaries, 'en', 'missingEverywhere')).toBe(
      'missingEverywhere',
    );
  });
});

describe('pick', () => {
  it('returns the value for the requested locale', () => {
    expect(pick('de', { en: 'cat', de: 'Katze' })).toBe('Katze');
    expect(pick('en', { en: 'cat', de: 'Katze' })).toBe('cat');
  });

  it('falls back to English when the locale variant is missing', () => {
    expect(pick('de', { en: 'cat' })).toBe('cat');
  });

  it('works for non-string values', () => {
    expect(pick('de', { en: ['a'], de: ['b'] })).toEqual(['b']);
  });
});

describe('t (bound to the real dictionaries)', () => {
  it('resolves a known key in every locale', () => {
    const key: UIKey = 'nav.projects';
    for (const locale of LOCALES) {
      expect(t(locale, key)).toBeTruthy();
    }
  });

  it('translates differently where a translation exists', () => {
    expect(t('de', 'nav.homelab')).not.toBe('');
  });
});

describe('nextLocale', () => {
  it('cycles through every locale and back to the first', () => {
    expect(nextLocale('en')).toBe('de');
    expect(nextLocale('de')).toBe('en');
  });

  it('never returns the same locale while several exist', () => {
    for (const locale of LOCALES) {
      expect(nextLocale(locale)).not.toBe(locale);
    }
  });
});

describe('getLocale', () => {
  it('returns a supported locale for the current build', () => {
    expect(LOCALES).toContain(getLocale());
  });
});

describe('ui dictionaries', () => {
  it('has no German keys that are unknown in English', () => {
    const englishKeys = new Set(Object.keys(ui.en));
    for (const key of Object.keys(ui.de)) {
      expect(englishKeys).toContain(key);
    }
  });

  it('has a non-empty English value for every key', () => {
    for (const [key, value] of Object.entries(ui.en)) {
      expect(value, `ui.en["${key}"]`).toBeTruthy();
    }
  });
});

describe('home page stat labels', () => {
  // These sit side by side under the homelab teaser, so an untranslated
  // one is immediately visible next to its translated neighbours.
  const STAT_KEYS = [
    'stats.storage',
    'stats.ram',
    'stats.uptime',
    'stats.services',
  ] as const;

  it('are translated in every dictionary, not just English', () => {
    for (const locale of LOCALES) {
      for (const key of STAT_KEYS) {
        expect(ui[locale][key], `${key} (${locale})`).toBeTruthy();
      }
    }
  });
});
