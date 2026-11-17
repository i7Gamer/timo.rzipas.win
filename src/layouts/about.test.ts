import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { JOBS } from '../data/jobs';
import { t } from '../i18n';
import { ui } from '../i18n/ui';

const ABOUT_PAGE = readFileSync(
  join(import.meta.dirname, '..', 'pages', 'about.astro'),
  'utf8',
);

describe('About me page naming', () => {
  it.each([
    ['en', 'About me'],
    ['de', 'Über mich'],
  ] as const)('is called %s in the nav and title', (locale, label) => {
    expect(t(locale, 'nav.about')).toBe(label);
    expect(t(locale, 'about.title')).toBe(label);
  });
});

describe('About me intro', () => {
  it.each(['en', 'de'] as const)(
    'focuses on the work rather than the employer in %s',
    (locale) => {
      const intro = t(locale, 'about.intro');
      expect(intro).not.toContain('Abacus');
      expect(intro).toContain('MySpeed');
      expect(intro).toMatch(/homelab/i);
    },
  );

  it('uses the agreed German wording', () => {
    expect(t('de', 'about.intro')).toContain(
      'Am meisten lerne ich in der Praxis:',
    );
  });
});

describe('About me contact', () => {
  it('puts the social icons and CV downloads in the header', () => {
    const header = ABOUT_PAGE.slice(
      ABOUT_PAGE.indexOf('<header'),
      ABOUT_PAGE.indexOf('</header>'),
    );
    expect(header).toContain('<SocialLinks locale={locale} size="lg" />');
    expect(header).toContain('<CvLinks locale={locale} />');
  });

  it('drops the contact panel and its texts', () => {
    expect(ABOUT_PAGE).not.toContain('ContactSection');
    for (const key of ['contact.title', 'contact.intro', 'contact.cv']) {
      expect(key in ui.en).toBe(false);
      expect(key in ui.de).toBe(false);
    }
  });
});

describe('About me layout', () => {
  it('spaces the sections further apart', () => {
    expect(ABOUT_PAGE).toContain('class="space-y-16"');
    expect(ABOUT_PAGE).not.toContain('space-y-10');
  });

  it('passes the collapsed flag through to the timeline', () => {
    expect(ABOUT_PAGE).toContain('collapsed={job.collapsed}');
  });
});

describe('experience entries', () => {
  it('shows Abacus as the current job again, without an end date', () => {
    const abacus = JOBS.find((job) => job.id === 'abacus')!;
    expect(abacus.to).toBeUndefined();
    expect(abacus.periodLabel).toBeUndefined();
    expect(abacus.from).toEqual({ year: 2019, month: 9 });
  });

  it('collapses only the early Stadler summer internships', () => {
    expect(JOBS.filter((job) => job.collapsed).map((job) => job.id)).toEqual([
      'early-stadler',
    ]);
  });
});
