import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { t } from '../i18n';

const HOME_PAGE = readFileSync(
  join(import.meta.dirname, '..', 'pages', 'index.astro'),
  'utf8',
);

describe('home page hero', () => {
  it('states the professional focus in both languages', () => {
    expect(t('en', 'hero.tagline')).toBe(
      'I develop business software with Java.',
    );
    expect(t('de', 'hero.tagline')).toBe(
      'Ich entwickle Business-Software mit Java.',
    );
  });

  it.each(['en', 'de'] as const)(
    'mentions Abacus document processing before projects and homelab in %s',
    (locale) => {
      const intro = t(locale, 'hero.intro');
      const abacus = intro.indexOf('Abacus');
      const projects = intro.search(/projects|Projekte/);
      const homelab = intro.search(/homelab/i);
      expect(intro).toMatch(/document processing|Belegverarbeitung/);
      expect(abacus).toBeGreaterThanOrEqual(0);
      expect(abacus).toBeLessThan(projects);
      expect(projects).toBeLessThan(homelab);
    },
  );
});

describe('home page contact', () => {
  it('renders the shared contact panel after the homelab teaser', () => {
    expect(HOME_PAGE).toContain(
      "import ContactSection from '../components/ContactSection.astro';",
    );
    expect(HOME_PAGE).toContain('<ContactSection locale={locale} />');
    expect(HOME_PAGE.indexOf('<ContactSection')).toBeGreaterThan(
      HOME_PAGE.indexOf('section.homelabTeaser.cta'),
    );
  });

  it('scrolls the hero contact link to the panel on the same page', () => {
    expect(HOME_PAGE).toContain('href="#contact"');
    expect(HOME_PAGE).not.toContain('/about/#contact');
  });

  it('keeps the homelab button', () => {
    expect(HOME_PAGE).toContain("t(locale, 'hero.cta.homelab')");
  });
});
