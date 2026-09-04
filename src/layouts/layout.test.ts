import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

import { SITE_URL } from '../data/site';

const SRC_DIR = join(import.meta.dirname, '..');

function read(file: string): string {
  return readFileSync(join(SRC_DIR, file), 'utf8');
}

/** Every max-width utility a file asks for, in source order. */
function maxWidthUtilities(file: string): string[] {
  return [...read(file).matchAll(/\bmax-w-[a-z0-9[\]-]+/g)].map(([hit]) => hit);
}

/** Header, main and footer frame the same column, so they must agree on it. */
const CHROME_FILES = [
  'layouts/BaseLayout.astro',
  'components/Header.astro',
  'components/Footer.astro',
];

describe('page container', () => {
  it('sets the content width exactly once per chrome file', () => {
    for (const file of CHROME_FILES) {
      expect(maxWidthUtilities(file), file).toHaveLength(1);
    }
  });

  it('uses one shared width in header, main and footer', () => {
    const used = new Set(CHROME_FILES.flatMap(maxWidthUtilities));
    expect([...used]).toEqual(['max-w-page']);
  });

  it('takes that width from a theme token, not a repeated scale step', () => {
    expect(read('styles/global.css')).toMatch(/--container-page:\s*[\d.]+rem;/);
  });
});

describe('hero terminal', () => {
  it('may shrink below the width of its own content', () => {
    // Its command lines are whitespace-nowrap behind an overflow-x-auto
    // scroller. Without min-w-0 that content-based minimum sizes the grid
    // track instead, and the whole hero overflows narrow viewports.
    const openingTag = /<div\b[^>]*\bdata-hero-terminal\b[^>]*>/.exec(
      read('pages/index.astro'),
    )?.[0];
    expect(openingTag).toMatch(/\bmin-w-0\b/);
  });
});

/** Every .astro file, so the shared-idiom guards below cover the whole site. */
const ASTRO_FILES = readdirSync(SRC_DIR, { recursive: true, encoding: 'utf8' })
  .filter((file) => file.endsWith('.astro'))
  .map((file) => file.split(sep).join('/'));

describe('shared idioms', () => {
  it('covers the whole site', () => {
    expect(ASTRO_FILES.length).toBeGreaterThan(5);
  });

  it('routes every panel surface through the panel utilities', () => {
    // border + bg + line colour together IS the panel; a file that spells
    // it out again is a second implementation waiting to drift.
    for (const file of ASTRO_FILES) {
      expect(read(file), file).not.toMatch(/border-line[^"']*\bbg-panel\b/);
    }
  });

  it('routes every button through the btn utilities', () => {
    // The shared box is rounded-md px-4 py-2 font-mono text-sm.
    for (const file of ASTRO_FILES) {
      expect(read(file), file).not.toMatch(/\brounded-md px-4 py-2\b/);
    }
  });
});

describe('header', () => {
  it('lets the nav shrink instead of pushing the page wider than the screen', () => {
    const navTag = /<nav\b[^>]*>/.exec(read('components/Header.astro'))?.[0];
    expect(navTag).toMatch(/\bmin-w-0\b/);
    expect(navTag).toMatch(/\boverflow-x-auto\b/);
  });
});

describe('vertical rhythm', () => {
  const CONTENT_PAGES = [
    'pages/index.astro',
    'pages/about.astro',
    'pages/homelab.astro',
    'pages/projects.astro',
  ];

  it('pads every content page the same', () => {
    for (const page of CONTENT_PAGES) {
      expect(read(page), page).toMatch(/\bpy-10\b/);
    }
  });

  it('separates stacked sections with the same gap everywhere', () => {
    for (const page of CONTENT_PAGES.filter((p) => !p.includes('projects'))) {
      expect(read(page), page).toContain('space-y-10');
    }
  });

  it('keeps no one-off section padding on the home page', () => {
    expect(read('pages/index.astro')).not.toMatch(/\bpt-2 pb-16\b|\bpb-16\b/);
  });
});

describe('hero', () => {
  it('splits into equal columns so the terminal gets a full-width line', () => {
    expect(read('pages/index.astro')).toMatch(/\blg:grid-cols-2\b/);
  });
});

describe('BaseLayout render', () => {
  async function render(): Promise<string> {
    const { experimental_AstroContainer: AstroContainer } =
      await import('astro/container');
    const { default: BaseLayout } = await import('./BaseLayout.astro');
    // The layout builds canonical and og:image URLs from Astro.site.
    const container = await AstroContainer.create({
      astroConfig: { site: SITE_URL },
    });
    return container.renderToString(BaseLayout, {
      request: new Request('https://timo.rzipas.win/about/'),
      slots: { default: '<p>body copy</p>' },
    });
  }

  it('starts in the default theme with the canonical URL of the page', async () => {
    const html = await render();
    expect(html).toContain('<html lang="en" class="dark">');
    expect(html).toContain(
      'rel="canonical" href="https://timo.rzipas.win/about/"',
    );
    expect(html).toContain('body copy');
  });

  // The bootstrap must sit after Astro's CSP <meta>, which is appended to
  // <head>, so it belongs at the very start of <body>.
  it('runs the theme bootstrap as the first thing in the body', async () => {
    const html = await render();
    const body = html.indexOf('<body');
    const bootstrap = html.indexOf('var config = {"storageKey"');
    expect(bootstrap).toBeGreaterThan(body);
    expect(html.slice(body, bootstrap)).not.toContain('<a ');
    expect(html).not.toContain('define:vars');
  });
});
