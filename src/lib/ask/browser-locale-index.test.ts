import { Window } from 'happy-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setupAskWork } from './browser';
import { langCookie } from '../../i18n/cookie';

describe('language-specific offline index paths', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    {
      siteLocale: 'de',
      locale: 'en',
      questions: [
        'Give me a good 200 word pitch about Timo',
        'This is not about 200 words',
        'Longer',
      ],
    },
    {
      siteLocale: 'en',
      locale: 'de',
      questions: [
        'Schreib mir einen Pitch über Timo in etwa 200 Wörtern',
        'Das sind keine 200 Wörter',
        'Länger bitte',
      ],
    },
  ] as const)(
    'keeps pitch requests, corrections, and expansions in the prompt language when the model is unavailable',
    async ({ siteLocale, locale, questions }) => {
      const window = new Window({ url: 'http://127.0.0.1:18093/' });
      try {
        vi.stubGlobal('document', window.document);
        window.document.documentElement.lang = siteLocale;
        const fetchMock = vi.fn<typeof fetch>(async (input) => {
          const path = String(input);
          if (path === `/ask-content-${locale}.json`)
            return Response.json({ locale, pages: [] });
          if (path === '/api/ask') return new Response(null, { status: 503 });
          throw new Error(`Unexpected request: ${path}`);
        });
        vi.stubGlobal('fetch', fetchMock);
        window.document.body.innerHTML =
          '<section data-mode="local" data-version="fixture"><div data-ask-result></div><form><textarea></textarea><button type="submit">Ask</button></form></section>';
        const panel = window.document.querySelector('section')!;
        const siteOffline = siteLocale === 'de' ? 'Offline DE.' : 'Offline EN.';
        const otherOffline = locale === 'de' ? 'Offline DE.' : 'Offline EN.';
        panel.dataset.messages = JSON.stringify({
          wait: 'Looking…',
          offline: siteOffline,
        });
        panel.dataset.askOtherMessages = JSON.stringify({
          wait: 'Suche…',
          offline: otherOffline,
        });
        const input = panel.querySelector('textarea')!;
        const button = panel.querySelector('button')!;
        setupAskWork(panel as unknown as HTMLElement);

        for (const [index, question] of questions.entries()) {
          input.value = question;
          panel
            .querySelector('form')!
            .dispatchEvent(new window.Event('submit'));
          await vi.waitFor(() =>
            expect(
              fetchMock.mock.calls.filter(([path]) => path === '/api/ask'),
            ).toHaveLength(index + 1),
          );
          await vi.waitFor(() => expect(button.disabled).toBe(false));
          expect(
            panel
              .querySelectorAll('[data-ask-user]')
              [index]?.getAttribute('lang'),
          ).toBe(locale);
          expect(
            panel.querySelectorAll('[data-ask-reply]')[index]?.textContent,
          ).toContain(locale === 'de' ? 'Offline DE.' : 'Offline EN.');
        }

        const requests = fetchMock.mock.calls.filter(
          ([path]) => path === '/api/ask',
        );
        const requestBodies = requests.map(([, init]) =>
          JSON.parse(String(init?.body)),
        );
        expect(
          requestBodies.map(({ locale: requestLocale }) => requestLocale),
        ).toEqual(questions.map(() => locale));
        expect(requestBodies[0].question).toBe(questions[0]);
        expect(
          requestBodies.slice(1).every(({ question }) => question.length > 0),
        ).toBe(true);
        expect(
          fetchMock.mock.calls.filter(([path]) =>
            String(path).startsWith('/ask-content-'),
          ),
        ).toHaveLength(questions.length);
        expect(
          fetchMock.mock.calls
            .filter(([path]) => String(path).startsWith('/ask-content-'))
            .map(([path]) => path),
        ).toEqual(questions.map(() => `/ask-content-${locale}.json`));
      } finally {
        window.close();
      }
    },
  );

  it('uses the question language fixed index when a shared locale cookie is stale', async () => {
    const window = new Window({ url: 'http://127.0.0.1:18093/' });
    try {
      vi.stubGlobal('document', window.document);
      window.document.documentElement.lang = 'en';
      window.document.cookie = langCookie('de', 'http:');
      expect(window.document.cookie).toContain('lang=de');
      const fetchMock = vi.fn<typeof fetch>(async (input) => {
        const path = String(input);
        if (path === '/ask-content-en.json')
          return Response.json({ locale: 'en', pages: [] });
        if (path === '/ask-content.json')
          return Response.json({ locale: 'de', pages: [] });
        throw new Error(`Unexpected index path: ${path}`);
      });
      vi.stubGlobal('fetch', fetchMock);
      window.document.body.innerHTML =
        '<section data-mode="index" data-version="fixture"><div data-ask-result></div><form><textarea></textarea><button type="submit">Ask</button></form></section>';
      const panel = window.document.querySelector('section')!;
      panel.dataset.messages = JSON.stringify({ wait: 'Looking…' });
      const input = panel.querySelector('textarea')!;
      setupAskWork(panel as unknown as HTMLElement);
      input.value = 'Can you tell me about projects?';
      panel.querySelector('form')!.dispatchEvent(new window.Event('submit'));
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
      expect(fetchMock).toHaveBeenCalledWith(
        '/ask-content-en.json',
        expect.objectContaining({ cache: 'no-cache' }),
      );
      expect(fetchMock).not.toHaveBeenCalledWith(
        '/ask-content.json',
        expect.anything(),
      );
    } finally {
      window.close();
    }
  });
});
