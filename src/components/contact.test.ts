import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';

import { CV_DOWNLOADS } from '../data/cv';
import { EMAIL, GITHUB_URL, LINKEDIN_URL } from '../data/site';
import { LOCALES } from '../i18n';
import CvLinks from './CvLinks.astro';
import SocialLinks from './SocialLinks.astro';

const SOCIAL_LINK_COUNT = 3;

describe('SocialLinks', () => {
  it.each(LOCALES)('links GitHub, LinkedIn and email in %s', async (locale) => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(SocialLinks, {
      props: { locale },
    });
    expect(html).toContain(`href="${GITHUB_URL}"`);
    expect(html).toContain(`href="${LINKEDIN_URL}"`);
    expect(html).toContain(`href="mailto:${EMAIL}"`);
    expect(html.match(/<svg/g)).toHaveLength(SOCIAL_LINK_COUNT);
    expect(html).toContain(
      `aria-label="${locale === 'en' ? 'Email' : 'E-Mail'}"`,
    );
  });

  it('opens only the external profiles in a new tab, without the CSS arrow', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(SocialLinks, {
      props: { locale: 'en' },
    });
    expect(html.match(/data-no-arrow/g)).toHaveLength(2);
    expect(html.match(/target="_blank"/g)).toHaveLength(2);
    expect(html).not.toMatch(/mailto:[^>]*target="_blank"/);
  });

  it.each([
    ['sm', 'size-5'],
    ['lg', 'size-6'],
  ] as const)('renders %s icons as %s', async (size, iconClass) => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(SocialLinks, {
      props: { locale: 'en', size },
    });
    expect(html.match(new RegExp(iconClass, 'g'))).toHaveLength(
      SOCIAL_LINK_COUNT,
    );
  });

  it('defaults to small icons', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(SocialLinks, {
      props: { locale: 'en' },
    });
    expect(html).toContain('size-5');
    expect(html).not.toContain('size-6');
  });
});

describe('CvLinks', () => {
  it.each(LOCALES)(
    'offers both CVs as downloads, matching language first, in %s',
    async (locale) => {
      const container = await AstroContainer.create();
      const html = await container.renderToString(CvLinks, {
        props: { locale },
      });
      const other = locale === 'en' ? 'de' : 'en';
      expect(html.indexOf(CV_DOWNLOADS[locale])).toBeLessThan(
        html.indexOf(CV_DOWNLOADS[other]),
      );
      expect(html.match(/ download/g)).toHaveLength(2);
      expect(html).toContain(`hreflang="${locale}"`);
      expect(html).toContain('type="application/pdf"');
      expect(html).toContain(
        locale === 'en' ? 'English CV · PDF' : 'Lebenslauf auf Deutsch · PDF',
      );
    },
  );
});
