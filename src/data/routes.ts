import type { UIKey } from '../i18n';

/**
 * Every page of the site, once. The header nav, the hero terminal's ls/cd
 * and the in-page links all derive from here; src/data/routes.test.ts
 * checks the list against the files under src/pages.
 */
export interface PageMeta {
  /** Nav label. */
  labelKey: UIKey;
  /** Extra names the terminal's `cd` accepts, e.g. the German page name. */
  aliases: readonly string[];
}

export const HOME_HREF = '/';
export const HOME_LABEL_KEY: UIKey = 'nav.home';

/** Keyed by slug — the file name under src/pages — in nav order. */
export const PAGES = {
  projects: { labelKey: 'nav.projects', aliases: ['projekte'] },
  homelab: { labelKey: 'nav.homelab', aliases: [] },
  about: { labelKey: 'nav.about', aliases: [] },
} as const satisfies Record<string, PageMeta>;

export type PageSlug = keyof typeof PAGES;

const PAGE_SLUGS = Object.keys(PAGES) as readonly PageSlug[];

/** Astro builds each page as a directory, so its URL ends in a slash. */
export function pageHref(slug: PageSlug): string {
  return `/${slug}/`;
}

export interface NavItem {
  href: string;
  labelKey: UIKey;
}

/** Header order: home first, then the pages as declared. */
export const NAV: readonly NavItem[] = [
  { href: HOME_HREF, labelKey: HOME_LABEL_KEY },
  ...PAGE_SLUGS.map((slug) => ({
    href: pageHref(slug),
    labelKey: PAGES[slug].labelKey,
  })),
];

/** Directory name -> href, the way the hero terminal's `cd` resolves them. */
export function shellNames(): Map<string, string> {
  const names = new Map<string, string>();
  for (const slug of PAGE_SLUGS) {
    for (const name of [slug, ...PAGES[slug].aliases]) {
      names.set(name, pageHref(slug));
    }
  }
  return names;
}
