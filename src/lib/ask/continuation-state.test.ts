import { Window } from 'happy-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareQuestion } from '../../../services/ask/selection.ts';
import { facts, normalize, sourcePage } from './catalog';
import { setupAskWork } from './browser';
import { acknowledgement, removeChatPrefix } from './history';
import { topicMoreIds } from './reviewed-questions';
import { answerTopic, topicContinuation } from './topics';

const HIRE_IDS = ['abacus-workflow', 'stadler-vpn', 'spotify-python'];
const text = (id: string, locale: 'en' | 'de' = 'en') =>
  facts.find((fact) => fact.id === id)!.answer[locale];
const hireAnswer = HIRE_IDS.map((id) => text(id)).join(' ');
const nextHire = topicContinuation('why hire timo')!
  .filter((id) => !HIRE_IDS.includes(id))
  .slice(0, HIRE_IDS.length);

describe('social turns', () => {
  it.each([
    'thanks',
    'thanks a lot',
    'thank you very much',
    'danke',
    'danke schoen',
    'vielen dank',
    'ok',
    'hi',
    'hallo',
    'how are you',
    'yes thats what i meant thanks',
  ])('treats %j as an acknowledgement', (turn) => {
    expect(acknowledgement.test(turn)).toBe(true);
  });

  it.each(['more', 'why hire timo', 'thanks for the cv'])(
    'does not treat %j as one',
    (turn) => {
      expect(acknowledgement.test(turn)).toBe(false);
    },
  );

  it('removes a leading greeting', () => {
    expect(removeChatPrefix('Hi, why hire Timo?')).toBe('why hire Timo?');
  });
});

describe('the topic of an earlier answer', () => {
  it('is read from the reviewed facts it showed', () => {
    expect(answerTopic(hireAnswer)).toBe('hire');
  });

  it.each([
    ['an unrelated answer', text('hearthcoil-game')],
    ['a partial topic answer', text('abacus-workflow')],
    ['', ''],
  ])('is undefined for %s', (_label, answer) => {
    expect(answerTopic(answer)).toBeUndefined();
  });
});

describe('more after a topic answer, whatever came between', () => {
  it.each([
    [
      'a greeting before the question',
      [{ question: 'Hi, why hire Timo?', answer: hireAnswer }],
    ],
    [
      'thanks a lot',
      [
        { question: 'why hire timo?', answer: hireAnswer },
        { question: 'Thanks a lot', answer: 'You’re welcome!' },
      ],
    ],
    [
      'danke schön',
      [
        { question: 'why hire timo?', answer: hireAnswer },
        { question: 'Danke schön', answer: 'Gern!' },
      ],
    ],
    [
      'a topic the selector inferred',
      [{ question: 'what makes him stand out?', answer: hireAnswer }],
    ],
  ])('continues the topic after %s', (_label, history) => {
    expect(topicMoreIds('any more reasons', history)).toEqual(nextHire);
  });
});

describe('the gateway without the site index', () => {
  const history = [{ question: 'Why hire Timo?', answer: hireAnswer }];

  it.each([
    ['Any more reasons?', 'en'],
    ['Weitere Gründe?', 'de'],
  ] as const)(
    'continues the hiring topic for %j instead of career facts',
    (question, locale) => {
      const prepared = prepareQuestion(question, locale, history);
      expect(prepared.fallback.status).toBe('answer');
      expect(prepared.fallback.claims.map(({ id }) => id)).toEqual(nextHire);
    },
  );

  it('abstains once the topic is exhausted', () => {
    const shown = topicContinuation('why hire timo')!
      .map((id) => text(id))
      .join(' ');
    const prepared = prepareQuestion('more', 'en', [
      { question: 'Why hire Timo?', answer: shown },
    ]);
    expect(prepared.fallback.status).toBe('unknown');
    expect(prepared.candidates).toEqual([]);
  });
});

describe('greeting and thanks in the chat', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('keeps the topic for “any more reasons?”', async () => {
    const window = new Window({ url: 'http://127.0.0.1:4511/' });
    try {
      const pages = [
        ...new Set(
          facts
            .map(({ sourceId }) => sourcePage(sourceId))
            .filter((href) => href.endsWith('/')),
        ),
      ].map((href) => ({ href, title: href, overview: [], sections: [] }));
      const fetchMock = vi.fn<typeof fetch>(async (input) =>
        String(input) === '/ask-content-en.json'
          ? Response.json({ locale: 'en', pages })
          : new Response(null, { status: 503 }),
      );
      vi.stubGlobal('fetch', fetchMock);
      vi.stubGlobal('document', window.document);
      window.document.documentElement.lang = 'en';
      window.document.body.innerHTML = `<section data-mode="local" data-version="fixture"><div data-ask-result></div><div data-ask-actions></div><form><textarea></textarea><button type="submit">Ask</button></form></section>`;
      const panel = window.document.querySelector(
        'section',
      )! as unknown as HTMLElement;
      panel.dataset.messages = JSON.stringify({ wait: '…', offline: 'Off.' });
      setupAskWork(panel);
      const ask = async (question: string) => {
        const count = panel.querySelectorAll('[data-ask-reply]').length;
        panel.querySelector('textarea')!.value = question;
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
        return panel.querySelectorAll('[data-ask-reply]')[count]!.textContent!;
      };
      expect(await ask('Hi, why hire Timo?')).toContain(text(HIRE_IDS[0]));
      await ask('Thanks a lot');
      const reply = await ask('any more reasons?');
      for (const id of nextHire)
        expect(normalize(reply)).toContain(normalize(text(id)).slice(0, 40));
      expect(
        fetchMock.mock.calls.filter(([input]) => input === '/api/ask'),
      ).toHaveLength(0);
    } finally {
      await window.happyDOM.close();
    }
  });
});
