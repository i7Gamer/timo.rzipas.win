import { Window } from 'happy-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { facts, normalize, sourcePage } from './catalog';
import { setupAskWork } from './browser';
import { questionLocale } from './conversation';
import { topicMoreIds } from './reviewed-questions';

describe('language of a request for more', () => {
  it.each([
    ['Mehr Gründe?', 'en', 'de'],
    ['Weitere Beispiele?', 'en', 'de'],
    ['Noch mehr Argumente?', 'en', 'de'],
    ['Andere Stärken?', 'en', 'de'],
    ['Additional details?', 'de', 'en'],
    ['Further examples?', 'de', 'en'],
    ['More reasons?', 'de', 'en'],
    ['Other strengths?', 'de', 'en'],
    ['Any more arguments?', 'de', 'en'],
  ] as const)('reads %j as %s after %s', (question, previous, expected) => {
    expect(questionLocale(question, previous)).toBe(expected);
  });

  it.each(['Details?', 'Infos?'])(
    'keeps the previous language for the ambiguous %j',
    (question) => {
      expect(questionLocale(question, 'de')).toBe('de');
      expect(questionLocale(question, 'en')).toBe('en');
    },
  );
});

describe('a language switch in the chat', () => {
  afterEach(() => vi.unstubAllGlobals());

  const pages = [
    ...new Set(
      facts
        .map(({ sourceId }) => sourcePage(sourceId))
        .filter((href) => href.endsWith('/')),
    ),
  ].map((href) => ({ href, title: href, overview: [], sections: [] }));

  it.each([
    ['en', 'Why hire Timo?', 'Mehr Gründe?', 'de'],
    ['de', 'Warum Timo einstellen?', 'Additional details?', 'en'],
  ] as const)(
    'answers a %s chat’s switch to %j in the new language',
    async (siteLocale, question, more, expected) => {
      const window = new Window({ url: 'http://127.0.0.1:4511/' });
      try {
        vi.stubGlobal(
          'fetch',
          vi.fn<typeof fetch>(async (input) => {
            const match = /^\/ask-content-(en|de)\.json$/.exec(String(input));
            return match
              ? Response.json({ locale: match[1], pages })
              : new Response(null, { status: 503 });
          }),
        );
        vi.stubGlobal('document', window.document);
        window.document.documentElement.lang = siteLocale;
        window.document.body.innerHTML = `<section data-mode="local" data-version="fixture"><div data-ask-result></div><form><textarea></textarea><button type="submit">Ask</button></form></section>`;
        const panel = window.document.querySelector(
          'section',
        )! as unknown as HTMLElement;
        panel.dataset.messages = JSON.stringify({ wait: '…' });
        setupAskWork(panel);
        const ask = async (text: string) => {
          const count = panel.querySelectorAll('[data-ask-reply]').length;
          panel.querySelector('textarea')!.value = text;
          panel
            .querySelector('form')!
            .dispatchEvent(new window.Event('submit') as unknown as Event);
          await vi.waitFor(() =>
            expect(panel.querySelectorAll('[data-ask-reply]')).toHaveLength(
              count + 1,
            ),
          );
          await vi.waitFor(() =>
            expect(panel.querySelector('button')!.disabled).toBe(false),
          );
          return panel.querySelectorAll('[data-ask-reply]')[count]!;
        };
        const first = await ask(question);
        const [next] = topicMoreIds('more', [
          { question: 'why hire timo', answer: first.textContent! },
        ])!;
        const reply = await ask(more);
        const expectedText = facts.find(({ id }) => id === next)!.answer[
          expected
        ];
        expect(normalize(reply.textContent!)).toContain(
          normalize(expectedText).slice(0, 40),
        );
        expect(reply.closest('[lang]')?.getAttribute('lang') ?? expected).toBe(
          expected,
        );
      } finally {
        await window.happyDOM.close();
      }
    },
  );
});
