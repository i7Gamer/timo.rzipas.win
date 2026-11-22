import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { t } from '../i18n';

const HOME_PAGE = readFileSync(
  join(import.meta.dirname, '..', 'pages', 'index.astro'),
  'utf8',
);

describe('home page hero', () => {
  it('states the professional focus in the terminal in both languages', () => {
    expect(t('en', 'terminal.whoami.out')).toBe(
      'Timo Rzipa · Java · Automated ERP document processing',
    );
    expect(t('de', 'terminal.whoami.out')).toBe(
      'Timo Rzipa · Java · Automatisierte Belegverarbeitung im ERP',
    );
  });

  it.each([
    {
      locale: 'en',
      location: 'Based in Switzerland',
      workflow:
        /primarily responsible.*receivables and payables documents after automatic recognition/,
      game: /Hearthcoil, a local co-op indie game in Unity/,
    },
    {
      locale: 'de',
      location: 'Wohnhaft in der Schweiz',
      workflow:
        /verantworte ich vor allem.*Debitoren- und Kreditorenbelege nach der automatischen Erkennung verarbeitet/,
      game: /In Unity entwickle ich Hearthcoil, ein Indie-Spiel mit lokalem Koop/,
    },
  ] as const)(
    'shows the current location, Abacus workflow and Hearthcoil in $locale',
    ({ locale, location, workflow, game }) => {
      const intro = t(locale, 'hero.intro');
      expect(t(locale, 'hero.location')).toBe(location);
      expect(intro).toContain('Abacus');
      expect(intro).toContain('Java/Vaadin');
      expect(intro).toMatch(workflow);
      expect(intro).toMatch(game);
      expect(intro.indexOf('Abacus')).toBeLessThan(intro.indexOf('Hearthcoil'));
      expect(intro).not.toMatch(/homelab|living room|Wohnzimmer/i);
    },
  );
});

describe('home page hero links', () => {
  it('shows the social icons, About me link and English CV download', () => {
    expect(HOME_PAGE).toContain('<SocialLinks locale={locale} size="lg" />');
    expect(HOME_PAGE).toContain("href={pageHref('about')}");
    expect(HOME_PAGE).toContain("t(locale, 'hero.cta.about')");
    expect(HOME_PAGE).toContain('href={CV_DOWNLOADS.en}');
    expect(HOME_PAGE).toContain('download');
    expect(HOME_PAGE).toContain("t(locale, 'hero.cta.cv')");
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
