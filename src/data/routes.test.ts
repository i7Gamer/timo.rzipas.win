import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { LOCALES, t } from '../i18n';
import { HOME_HREF, NAV, PAGES, pageHref, shellNames } from './routes';

/** Page files under src/pages, minus the home page and the error page. */
const PAGE_FILES = readdirSync(join(import.meta.dirname, '../pages'))
  .filter((file) => file.endsWith('.astro'))
  .map((file) => file.replace(/\.astro$/, ''))
  .filter((name) => name !== 'index' && name !== '404');

describe('PAGES', () => {
  // A page added under src/pages without a route entry would be missing
  // from the nav and from the terminal's ls/cd, and vice versa.
  it('lists exactly the page files under src/pages', () => {
    expect(Object.keys(PAGES).sort()).toEqual([...PAGE_FILES].sort());
  });

  it('labels every page in every locale', () => {
    for (const { labelKey } of Object.values(PAGES)) {
      for (const locale of LOCALES) {
        expect(t(locale, labelKey), `${labelKey} (${locale})`).not.toBe(
          labelKey,
        );
      }
    }
  });
});

describe('pageHref', () => {
  it('is the directory URL of the slug, as Astro builds it', () => {
    expect(pageHref('projects')).toBe('/projects/');
    expect(pageHref('about')).toBe('/about/');
  });
});

describe('NAV', () => {
  it('starts at home, then visits every page once in declaration order', () => {
    expect(NAV.map((item) => item.href)).toEqual([
      HOME_HREF,
      ...Object.keys(PAGES).map((slug) => pageHref(slug as keyof typeof PAGES)),
    ]);
  });

  it('labels home in every locale', () => {
    for (const locale of LOCALES) {
      expect(t(locale, NAV[0].labelKey)).not.toBe(NAV[0].labelKey);
    }
  });
});

describe('shellNames', () => {
  it('maps every slug and every alias to its page', () => {
    expect(shellNames().get('projects')).toBe('/projects/');
    expect(shellNames().get('projekte')).toBe('/projects/');
    expect(shellNames().get('about')).toBe('/about/');
  });

  it('never lets an alias shadow a slug', () => {
    const slugs = Object.keys(PAGES);
    const aliases = Object.values(PAGES).flatMap((page) => page.aliases);
    for (const alias of aliases) {
      expect(slugs).not.toContain(alias);
    }
    expect(new Set(aliases).size).toBe(aliases.length);
  });
});
