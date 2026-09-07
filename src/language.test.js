import { describe, expect, it } from 'vitest';
import language from '../deploy/language.js';
import locales from './i18n/locales.json';

describe('nginx language negotiation', () => {
  it.each([
    [undefined, 'en'],
    ['', 'en'],
    ['fr', 'en'],
    ['de-CH,de;q=0.9,en;q=0.8', 'de'],
    ['fr-CH,fr;q=0.9,de;q=0.8,en;q=0.7', 'de'],
    ['de;q=0,en;q=1', 'en'],
    ['en;q=0.2,de;q=0.9', 'de'],
    ['de;q=0.2,en;q=0.9', 'en'],
    ['de,en', 'de'],
    ['en,de', 'en'],
    [' DE-at ; Q=0.8 , en;q=0.7 ', 'de'],
    ['de;q=bogus,en;q=0.5', 'en'],
    ['de;q=2,en', 'en'],
    ['de;q=-1,en', 'en'],
    ['de;q=0.1234,en', 'en'],
    ['de;q=1.000,en;q=0.999', 'de'],
    ['de;q=0.001,en;q=0', 'de'],
    ['de;q=0,*;q=1', 'en'],
    ['en;q=0,*;q=1', 'de'],
    ['*;q=1,de;q=0.5', 'en'],
    ['*;q=0,de;q=0.5', 'de'],
    ['de;q=0,en;q=0', 'en'],
    ['de;q=0.1,de;q=0.9,en;q=0.5', 'de'],
    ['deevil,en', 'en'],
    ['de;q=0.5;broken,en', 'en'],
  ])('selects %s → %s', (header, expected) => {
    expect(language.accept({ headersIn: { 'Accept-Language': header } })).toBe(
      expected,
    );
  });

  it('supports every built locale', () => {
    for (const locale of locales) {
      expect(
        language.accept({ headersIn: { 'Accept-Language': locale } }),
      ).toBe(locale);
    }
  });
});
