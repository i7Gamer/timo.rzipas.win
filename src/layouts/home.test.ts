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

describe('home page hero links', () => {
  it('shows the social icons and an About me link instead of buttons', () => {
    expect(HOME_PAGE).toContain('<SocialLinks locale={locale} size="lg" />');
    expect(HOME_PAGE).toContain("href={pageHref('about')}");
    expect(HOME_PAGE).toContain("t(locale, 'hero.cta.about')");
    expect(HOME_PAGE).not.toContain('hero.cta.projects');
    expect(HOME_PAGE).not.toContain('hero.cta.homelab');
  });

  it.each([
    ['en', 'About me'],
    ['de', 'Über mich'],
  ] as const)('labels the About me link in %s', (locale, label) => {
    expect(t(locale, 'hero.cta.about')).toBe(label);
  });

  it('no longer renders the contact panel or its scroll link', () => {
    expect(HOME_PAGE).not.toContain('ContactSection');
    expect(HOME_PAGE).not.toContain('#contact');
    expect(HOME_PAGE).not.toContain('data-contact-cta');
  });
});

describe('home page portrait', () => {
  it('shows the portrait next to the greeting', () => {
    expect(HOME_PAGE).toContain(
      "import portrait from '../assets/portrait.jpg';",
    );
    expect(HOME_PAGE).toContain('src={portrait}');
    expect(HOME_PAGE).toContain("alt={t(locale, 'hero.portraitAlt')}");
    expect(HOME_PAGE.indexOf('src={portrait}')).toBeLessThan(
      HOME_PAGE.indexOf("t(locale, 'hero.greeting')"),
    );
  });

  it.each(['en', 'de'] as const)('describes the portrait in %s', (locale) => {
    expect(t(locale, 'hero.portraitAlt')).toMatch(/Timo Rzipa/);
  });
});
