import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';
import type { Locale } from '../src/i18n';
import { PET_SOURCE_PATH } from '../src/lib/ask/catalog';
import { publicFactBundle } from '../src/lib/ask/version';
import {
  SITE_CONTENT_PATH,
  type SiteContent,
  type SitePage,
} from '../src/lib/ask/site-content';

const boundary =
  /^(?:ADDRESS|ARTICLE|ASIDE|BLOCKQUOTE|DD|DETAILS|DIV|DL|DT|FIGCAPTION|FIGURE|FOOTER|HEADER|LI|OL|P|PRE|SECTION|TABLE|TD|TH|TR|UL)$/;
const heading = /^(?:H[1-6]|SUMMARY)$/;
const HIGHEST_HEADING_LEVEL = 6;
const clean = (input: string) => input.replace(/\s+/g, ' ').trim();

export function extractPage(html: string, href: string): SitePage {
  const window = new Window({
    settings: {
      enableJavaScriptEvaluation: false,
      disableJavaScriptFileLoading: true,
    },
  });
  try {
    const document = new window.DOMParser().parseFromString(html, 'text/html');
    const main = document.querySelector('main');
    if (!main) throw new Error('Could not find public content on ' + href);
    for (const element of main.querySelectorAll(
      'nav, script, style, template, svg, [hidden], [aria-hidden="true"], [data-ask-exclude], [data-status-label]',
    ))
      element.remove();
    // Keep date/location metadata with its entry, whose heading follows it visually.
    for (const title of main.querySelectorAll('[data-ask-entry] h3'))
      title.parentElement?.prepend(title);
    const title = clean(
      main.querySelector('h1')?.textContent ?? document.title,
    );
    const overview = Array.from(
      main.querySelectorAll('[data-ask-overview]'),
      (element) => clean(element.textContent),
    ).filter(Boolean);
    const sections: SitePage['sections'] = [];
    const headings = new Map<number, string>();
    let section = { heading: title, paragraphs: [] as string[] };
    sections.push(section);
    let buffer = '';
    const flush = () => {
      const text = clean(buffer);
      if (text) section.paragraphs.push(text);
      buffer = '';
    };
    const append = (part: string) => {
      if (/[\p{L}\p{N}]$/u.test(buffer) && /^[\p{L}\p{N}]/u.test(part))
        buffer += ' ';
      buffer += part;
    };
    const walk = (node: typeof main | (typeof main)['childNodes'][number]) => {
      if (node.nodeType === 3) {
        append(node.textContent ?? '');
        return;
      }
      if (node.nodeType !== 1) return;
      if (node.nodeName === 'BR') {
        append(' ');
        return;
      }
      const wrapsHeading =
        node.nodeName === 'SUMMARY' &&
        node instanceof window.Element &&
        node.querySelector('h2, h3, h4, h5, h6');
      if (!wrapsHeading && heading.test(node.nodeName)) {
        flush();
        const name = clean(node.textContent ?? '');
        if (name && (node.nodeName !== 'H1' || name !== title)) {
          const level =
            node.nodeName === 'SUMMARY'
              ? HIGHEST_HEADING_LEVEL
              : Number(node.nodeName[1]);
          for (const depth of headings.keys())
            if (depth >= level) headings.delete(depth);
          headings.set(level, name);
          section = {
            heading: [...headings.values()].join(' › '),
            paragraphs: [],
          };
          sections.push(section);
        }
        return;
      }
      const block = boundary.test(node.nodeName);
      if (block) flush();
      for (const child of node.childNodes) walk(child);
      if (block) flush();
    };
    walk(main);
    flush();
    return { href, title, overview, sections };
  } finally {
    window.close();
  }
}

export async function writeSiteContent(dir: URL, locale: Locale) {
  const root = fileURLToPath(dir);
  const pages: SitePage[] = [];
  for (const entry of await readdir(root, {
    recursive: true,
    withFileTypes: true,
  })) {
    if (!entry.isFile() || entry.name !== 'index.html') continue;
    const path = relative(root, entry.parentPath);
    const href = path ? '/' + path.split(sep).join('/') + '/' : '/';
    const html = await readFile(join(entry.parentPath, entry.name), 'utf8');
    pages.push(extractPage(html, href));
  }
  pages.sort((a, b) => a.href.localeCompare(b.href));
  const index: SiteContent = { locale, pages };
  const pets = await readFile(
    new URL('../src/data/ask/pets.txt', import.meta.url),
  );

  await Promise.all([
    writeFile(new URL(PET_SOURCE_PATH.slice(1), dir), pets),
    writeFile(new URL(SITE_CONTENT_PATH.slice(1), dir), JSON.stringify(index)),
    writeFile(
      new URL('ask-facts.json', dir),
      JSON.stringify(publicFactBundle()),
    ),
  ]);
}
