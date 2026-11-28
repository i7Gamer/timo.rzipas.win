import { Window } from 'happy-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { catalogDownload, facts, sourcePage } from './catalog';
import { setupAskWork } from './browser';
import { findSiteContent, parseSiteContent } from './site-content';

const CV = {
  en: '/downloads/timo-rzipa-cv-en.pdf',
  de: '/downloads/timo-rzipa-cv-de.pdf',
} as const;

const pages = [
  ...new Set(
    facts
      .map(({ sourceId }) => sourcePage(sourceId))
      .filter((href) => href.endsWith('/')),
  ),
].map((href) => ({ href, title: href, overview: [], sections: [] }));
const index = (locale: 'en' | 'de') =>
  parseSiteContent({ locale, pages }, locale)!;

describe('catalogue downloads', () => {
  it.each([
    [CV.en + '#page=1', CV.en],
    [CV.de + '#page=2', CV.de],
    [CV.en, CV.en],
    [
      '/downloads/timo-rzipa-bachelor-thesis.pdf#page=1',
      '/downloads/timo-rzipa-bachelor-thesis.pdf',
    ],
  ])('allows the reviewed file %j', (href, file) => {
    expect(catalogDownload(href)).toBe(file);
  });

  it.each([
    '/downloads/unknown.pdf',
    '/downloads/timo-rzipa-cv-en.pdf?x=1',
    'https://example.com/downloads/timo-rzipa-cv-en.pdf',
    '//example.com/downloads/timo-rzipa-cv-en.pdf',
    'javascript:alert(1)',
    '/about/',
  ])('rejects %j', (href) => {
    expect(catalogDownload(href)).toBeUndefined();
  });
});

describe('download requests', () => {
  it.each([
    ['CV download', 'en', CV.en],
    ['download his resume', 'en', CV.en],
    ['cv pdf', 'en', CV.en],
    ['Lebenslauf herunterladen', 'de', CV.de],
    ['Lebenslauf PDF', 'de', CV.de],
  ] as const)('offers the %s file for %j', (question, locale, file) => {
    const answer = findSiteContent(question, index(locale), 'overview');
    expect(answer?.status).toBe('answer');
    expect(answer?.downloads).toEqual([file]);
  });

  it.each(['cv', 'Tell me about his education'])(
    'offers no download for %j',
    (question) => {
      expect(
        findSiteContent(question, index('en'), 'overview')?.downloads,
      ).toBeUndefined();
    },
  );
});

describe('downloads in the chat', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ['en', 'CV download', CV.en, 'Download'],
    ['de', 'Lebenslauf herunterladen', CV.de, 'herunterladen'],
  ] as const)(
    'renders a %s download link',
    async (locale, question, file, label) => {
      const window = new Window({ url: 'http://127.0.0.1:4511/' });
      try {
        vi.stubGlobal(
          'fetch',
          vi.fn<typeof fetch>(async (input) =>
            String(input) === `/ask-content-${locale}.json`
              ? Response.json({ locale, pages })
              : new Response(null, { status: 503 }),
          ),
        );
        vi.stubGlobal('document', window.document);
        window.document.documentElement.lang = locale;
        window.document.body.innerHTML = `<section data-mode="local" data-version="fixture"><div data-ask-result></div><form><textarea></textarea><button type="submit">Ask</button></form></section>`;
        const panel = window.document.querySelector(
          'section',
        )! as unknown as HTMLElement;
        panel.dataset.messages = JSON.stringify({ wait: '…' });
        setupAskWork(panel);
        panel.querySelector('textarea')!.value = question;
        panel
          .querySelector('form')!
          .dispatchEvent(new window.Event('submit') as unknown as Event);
        await vi.waitFor(() =>
          expect(
            panel.querySelector('[data-ask-reply] a[download]'),
          ).not.toBeNull(),
        );
        const link = panel.querySelector('[data-ask-reply] a[download]')!;
        expect(link.getAttribute('href')).toBe(file);
        expect(link.textContent).toContain(label);
        expect(
          panel.querySelector(`[data-ask-reply] a[href^="${file}#"]`),
        ).not.toBeNull();
        expect(
          panel.querySelector('[data-ask-reply] [data-ask-attribution]'),
        ).toBeNull();
      } finally {
        await window.happyDOM.close();
      }
    },
  );
});
