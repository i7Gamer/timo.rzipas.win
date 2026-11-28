import { Window } from 'happy-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_CLAIMS, facts, normalize, sourcePage } from './catalog';
import { setupAskWork } from './browser';
import { moreQuestion, topicMoreIds } from './reviewed-questions';
import { topicContinuation } from './topics';

const HIRE_IDS = ['abacus-workflow', 'stadler-vpn', 'spotify-python'];
const text = (id: string, locale: 'en' | 'de' = 'en') =>
  facts.find((fact) => fact.id === id)!.answer[locale];
const turn = (question: string, ids: readonly string[]) => ({
  question,
  answer: ids.map((id) => text(id)).join(' '),
});

describe('requests for more', () => {
  it.each([
    'any more reasons',
    'more reasons',
    'other reasons',
    'any other reasons',
    'some more examples',
    'further details',
    'additional points',
    'any more strengths',
    'weitere gruende',
    'noch mehr gruende',
    'andere beispiele',
    'mehr argumente',
  ])('recognizes %j', (question) => {
    expect(moreQuestion.test(question)).toBe(true);
  });

  it.each([
    'more projects',
    'other jobs',
    'reasons',
    'more reasons for hearthcoil',
  ])('leaves %j to its own route', (question) => {
    expect(moreQuestion.test(question)).toBe(false);
  });
});

describe('topic continuation pool', () => {
  it('follows the topic facts with its longer summary, without repeats', () => {
    const pool = topicContinuation('why hire timo')!;
    expect(pool.slice(0, HIRE_IDS.length)).toEqual(HIRE_IDS);
    expect(new Set(pool).size).toBe(pool.length);
    expect(pool.length).toBeGreaterThan(HIRE_IDS.length);
  });

  it('is the topic facts alone without a longer summary', () => {
    expect(topicContinuation('hobbies')).toEqual(['portfolio-leisure']);
  });

  it.each([
    'Tell me about Hearthcoil',
    'cv and hobbies',
    'work experience',
    '',
  ])('is undefined for %j', (question) => {
    expect(topicContinuation(normalize(question))).toBeUndefined();
  });
});

describe('more after a topic answer', () => {
  it('continues with unseen reviewed facts of the same topic', () => {
    const ids = topicMoreIds('any more reasons', [
      turn('why hire timo?', HIRE_IDS),
    ])!;
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.length).toBeLessThanOrEqual(MAX_CLAIMS);
    for (const id of HIRE_IDS) expect(ids).not.toContain(id);
    expect(ids).toEqual(
      topicContinuation('why hire timo')!
        .filter((id) => !HIRE_IDS.includes(id))
        .slice(0, MAX_CLAIMS),
    );
  });

  it('keeps going after an earlier “more” and skips acknowledgements', () => {
    const first = topicMoreIds('more', [turn('why hire timo?', HIRE_IDS)])!;
    const second = topicMoreIds('other reasons', [
      turn('why hire timo?', HIRE_IDS),
      turn('more', first),
      { question: 'thanks', answer: 'You’re welcome.' },
    ])!;
    for (const id of [...HIRE_IDS, ...first]) expect(second).not.toContain(id);
  });

  it('is empty once every fact of the topic was shown', () => {
    const pool = topicContinuation('why hire timo')!;
    expect(topicMoreIds('more', [turn('why hire timo?', pool)])).toEqual([]);
  });

  it.each([
    ['more', [turn('Tell me about Hearthcoil', ['hearthcoil-game'])]],
    ['why hire timo', [turn('why hire timo?', HIRE_IDS)]],
    ['more', []],
  ] as const)('does not apply to %j after %j', (question, history) => {
    expect(topicMoreIds(question, history)).toBeUndefined();
  });
});

const pages = [
  ...new Set(
    facts
      .map(({ sourceId }) => sourcePage(sourceId))
      .filter((href) => href.endsWith('/')),
  ),
].map((href) => ({ href, title: href, overview: [], sections: [] }));

describe('more after a topic answer in the chat', () => {
  afterEach(() => vi.unstubAllGlobals());

  async function chat(locale: 'en' | 'de') {
    const window = new Window({ url: 'http://127.0.0.1:4511/' });
    const fetchMock = vi.fn<typeof fetch>(async (input) =>
      String(input) === `/ask-content-${locale}.json`
        ? Response.json({ locale, pages })
        : new Response(null, { status: 503 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('document', window.document);
    window.document.documentElement.lang = locale;
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
    const modelCalls = () =>
      fetchMock.mock.calls.filter(([input]) => String(input) === '/api/ask')
        .length;
    return { window, ask, modelCalls };
  }

  it.each([
    ['en', 'why hire timo?', 'any more reasons?'],
    ['de', 'Warum Timo einstellen?', 'Weitere Gründe?'],
  ] as const)(
    'answers %s “more reasons” locally with new facts',
    async (locale, question, more) => {
      const { window, ask, modelCalls } = await chat(locale);
      try {
        await ask(question);
        const reply = await ask(more);
        const expected = topicMoreIds('more', [
          turn('why hire timo?', HIRE_IDS),
        ])!;
        for (const id of expected)
          expect(reply).toContain(text(id, locale).slice(0, 40));
        expect(reply).not.toContain(text('abacus-workflow', locale));
        expect(modelCalls()).toBe(0);
      } finally {
        await window.happyDOM.close();
      }
    },
  );

  it('says when the topic has nothing more', async () => {
    const { window, ask, modelCalls } = await chat('en');
    try {
      await ask('hobbies');
      expect(await ask('anything else?')).toMatch(/everything I have/);
      expect(modelCalls()).toBe(0);
    } finally {
      await window.happyDOM.close();
    }
  });
});
