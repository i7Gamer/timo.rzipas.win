import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';

import Footer from './Footer.astro';

describe('Footer', () => {
  it('opens the icon links in a new tab, opting out of the CSS arrow', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Footer);
    // GitHub and LinkedIn — icon-only, so no ↗ after the logo.
    expect(html.match(/data-no-arrow/g)).toHaveLength(2);
    expect(html.match(/target="_blank"/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('keeps the mail link out of the new-tab handling', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Footer);
    expect(html).toContain('mailto:');
    expect(html).not.toMatch(/mailto:[^>]*target="_blank"/);
  });

  it('labels the mail link in the page language', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Footer);
    // The container renders the default (English) build.
    expect(html).toContain('aria-label="Email"');
  });
});
