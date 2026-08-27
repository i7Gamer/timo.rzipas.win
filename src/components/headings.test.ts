import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';

import PathHeading from './PathHeading.astro';
import SectionHeading from './SectionHeading.astro';

describe('PathHeading', () => {
  it('renders the page name as a shell path', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(PathHeading, {
      props: { path: 'homelab' },
    });
    expect(html).toMatch(/<h1/);
    expect(html).toContain('homelab');
    expect(html).toContain('~/');
  });

  // The ~/ is ornament; a screen reader should read "homelab", not "tilde slash".
  it('hides the prefix from screen readers', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(PathHeading, {
      props: { path: 'about' },
    });
    expect(html).toMatch(/aria-hidden="true"[^>]*>~\//);
  });
});

describe('SectionHeading', () => {
  it('renders its slot under a markdown-style prefix', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(SectionHeading, {
      slots: { default: 'Featured projects' },
    });
    expect(html).toMatch(/<h2/);
    expect(html).toContain('Featured projects');
    expect(html).toMatch(/aria-hidden="true"[^>]*>##/);
  });

  it('takes an id so sections can be linked to', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(SectionHeading, {
      props: { id: 'services' },
      slots: { default: 'Running services' },
    });
    expect(html).toContain('id="services"');
  });

  it('omits the id attribute when none is given', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(SectionHeading, {
      slots: { default: 'Hardware' },
    });
    expect(html).not.toContain('id=');
  });
});
