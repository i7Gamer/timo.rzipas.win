import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';

import Header from './Header.astro';
import LanguageSwitcher from './LanguageSwitcher.astro';
import ThemeToggle from './ThemeToggle.astro';

/** Header reads Astro.url, so every render needs the page it is rendered on. */
async function renderHeader(pathname: string): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(Header, {
    request: new Request(`https://timo.rzipas.win${pathname}`),
  });
}

describe('Header', () => {
  it('links every section of the site', async () => {
    const html = await renderHeader('/');
    for (const href of ['/', '/projects/', '/homelab/', '/about/']) {
      expect(html, href).toContain(`href="${href}"`);
    }
  });

  it('marks the page being viewed, and only that one', async () => {
    const html = await renderHeader('/projects/');
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toMatch(/href="\/projects\/"[^>]*aria-current="page"/);
  });

  it('moves the marker with the page', async () => {
    const html = await renderHeader('/about/');
    expect(html).toMatch(/href="\/about\/"[^>]*aria-current="page"/);
  });

  it('names the navigation for screen readers', async () => {
    expect(await renderHeader('/')).toContain('aria-label="Main"');
  });

  // The ~/timo logo is the home link on small screens, so the nav's own
  // Home entry would be a duplicate there.
  it('hides the redundant Home entry on small screens', async () => {
    expect(await renderHeader('/')).toMatch(
      /href="\/"[^>]*class="[^"]*hidden sm:inline-block/,
    );
  });

  it('lets the nav shrink rather than widening the page', async () => {
    const html = await renderHeader('/');
    expect(html).toMatch(/<nav[^>]*min-w-0/);
    expect(html).toMatch(/<nav[^>]*overflow-x-auto/);
  });
});

describe('LanguageSwitcher', () => {
  // The label is written in the language being offered, so it needs its own
  // lang or a screen reader reads German with English phonemes (WCAG 3.1.2).
  it('marks the foreign-language label with its own lang', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(LanguageSwitcher);
    expect(html).toMatch(/<button[^>]*lang="de"/);
  });

  it('offers the other locale, labelled in the language being offered', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(LanguageSwitcher);
    // The container renders the default (English) build.
    expect(html).toContain('data-target="de"');
    expect(html).toContain('>DE<');
    expect(html).toContain('aria-label="Zu Deutsch wechseln"');
  });
});

describe('ThemeToggle', () => {
  // Without a state, a screen reader user cannot tell which theme is on.
  it('exposes the current theme as a toggle state', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ThemeToggle);
    expect(html).toMatch(/<button[^>]*aria-pressed="(true|false)"/);
  });

  it('is labelled and carries an icon for each theme', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ThemeToggle);
    expect(html).toContain('aria-label="Toggle color theme"');
    expect(html.match(/<svg/g)).toHaveLength(2);
    // Decorative — the button's own label is what gets announced.
    expect(html.match(/aria-hidden="true"/g)).toHaveLength(2);
  });
});
