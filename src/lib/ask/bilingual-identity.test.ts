import { Window } from 'happy-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { facts, normalize, sourcePage } from './catalog';
import { setupAskWork } from './browser';
import { resolveChoice } from './conversation';
import { profileQuestionChoices } from './reviewed-questions';
import {
  findSiteContent,
  parseSiteContent,
  type SitePage,
} from './site-content';

const LEISURE = 'portfolio-leisure';
const HOMELAB_MOTIVATION = 'homelab-motivation';

describe('answer choices in either language', () => {
  it.each([
    ['en', 'Projekte'],
    ['en', 'projects'],
    ['de', 'Projects'],
    ['de', 'Projekte'],
  ] as const)('resolves a %s offer from %j', (locale, answer) => {
    const choices = profileQuestionChoices('motivation', locale)!;
    expect(resolveChoice(answer, choices)).toEqual([LEISURE]);
  });

  it.each(['en', 'de'] as const)(
    'gives every %s choice a stable id and both names',
    (locale) => {
      const choices = profileQuestionChoices('motivation', locale)!;
      expect(choices.map(({ id }) => id)).toEqual(['homelab', 'projects']);
      expect(choices[1].names).toEqual(
        expect.arrayContaining(['Projects', 'Projekte']),
      );
    },
  );
});

const page = (locale: 'en' | 'de'): SitePage => ({
  href: '/homelab/',
  title: 'Homelab',
  overview: [],
  sections: [
    { heading: 'Hardware', paragraphs: [] },
    {
      heading: 'Hardware › Server',
      paragraphs: [locale === 'de' ? 'Läuft immer' : 'Always on'],
    },
    {
      heading:
        locale === 'de' ? 'Hardware › Dev-Server' : 'Hardware › Dev server',
      paragraphs: [
        locale === 'de'
          ? 'Spielwiese für Experimente'
          : 'Playground for experiments',
        'CPU AMD Ryzen 9 5950X',
      ],
    },
    {
      heading: locale === 'de' ? 'Warum selbst hosten?' : 'Why self-host?',
      paragraphs: [
        locale === 'de' ? 'Weil es Spass macht.' : 'Because it is fun.',
      ],
    },
  ],
});
const index = (locale: 'en' | 'de') =>
  parseSiteContent({ locale, pages: [page(locale)] }, locale)!;
const excerpts = (answer: ReturnType<typeof findSiteContent>) =>
  answer?.sources.flatMap(({ excerpts }) => excerpts) ?? [];

describe('a remembered section in the other language', () => {
  const devServer = {
    href: '/homelab/',
    label: 'Dev server',
    heading: 'Hardware › Dev server',
    section: 2,
  };
  const earlier = [
    {
      question: 'Tell me about the dev server',
      answer: 'Playground for experiments',
    },
  ];

  it('continues the same section on the German page', () => {
    const answer = findSiteContent(
      'Weitere Details?',
      index('de'),
      'related',
      devServer,
      earlier,
    );
    expect(excerpts(answer)).toEqual([
      'Spielwiese für Experimente',
      'CPU AMD Ryzen 9 5950X',
    ]);
    expect(answer?.subjects).toEqual([
      expect.objectContaining({ heading: 'Hardware › Dev-Server' }),
    ]);
  });

  it('asks which section is meant when it cannot be matched', () => {
    const answer = findSiteContent(
      'Weitere Details?',
      index('de'),
      'related',
      { ...devServer, section: undefined },
      earlier,
    );
    expect(excerpts(answer)).toEqual([]);
    expect(answer?.note).toMatch(/Abschnitt/);
    expect(answer?.note).not.toMatch(/alles/);
  });

  it('remembers the section position with the subject', () => {
    const answer = findSiteContent(
      'more',
      index('en'),
      'related',
      devServer,
      earlier,
    );
    expect(answer?.subjects).toEqual([
      expect.objectContaining({ heading: 'Hardware › Dev server', section: 2 }),
    ]);
  });
});

describe('choices in a bilingual chat', () => {
  afterEach(() => vi.unstubAllGlobals());

  const pages = [
    ...new Set(
      facts
        .map(({ sourceId }) => sourcePage(sourceId))
        .filter((href) => href.endsWith('/')),
    ),
  ].map((href) => ({ href, title: href, overview: [], sections: [] }));

  async function chat() {
    const window = new Window({ url: 'http://127.0.0.1:4511/' });
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const match = /^\/ask-content-(en|de)\.json$/.exec(String(input));
      return match
        ? Response.json({ locale: match[1], pages })
        : new Response(null, { status: 503 });
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('document', window.document);
    window.document.documentElement.lang = 'en';
    window.document.body.innerHTML = `<section data-mode="local" data-version="fixture"><div data-ask-result></div><div data-ask-actions></div><form><textarea></textarea><button type="submit">Ask</button></form></section>`;
    const panel = window.document.querySelector(
      'section',
    )! as unknown as HTMLElement;
    panel.dataset.messages = JSON.stringify({ wait: '…', offline: 'Off.' });
    setupAskWork(panel);
    const replies = () => panel.querySelectorAll('[data-ask-reply]');
    const settle = async (count: number) => {
      await vi.waitFor(() => expect(replies()).toHaveLength(count + 1));
      await vi.waitFor(() =>
        expect(
          panel.querySelector('form button')!.hasAttribute('disabled'),
        ).toBe(false),
      );
      return replies()[count]!.textContent!;
    };
    const ask = async (question: string) => {
      const count = replies().length;
      panel.querySelector('textarea')!.value = question;
      panel
        .querySelector('form')!
        .dispatchEvent(new window.Event('submit') as unknown as Event);
      return settle(count);
    };
    const click = async (label: string) => {
      const count = replies().length;
      const button = Array.from(
        panel.querySelectorAll<HTMLButtonElement>('[data-ask-actions] button'),
      ).find((entry) => entry.textContent === label)!;
      button.click();
      return settle(count);
    };
    const modelCalls = () =>
      fetchMock.mock.calls.filter(([input]) => input === '/api/ask').length;
    return { window, ask, click, modelCalls };
  }

  const text = (id: string, locale: 'en' | 'de') =>
    normalize(facts.find((fact) => fact.id === id)!.answer[locale]);

  it('answers a German pick of an English offer', async () => {
    const { window, ask, modelCalls } = await chat();
    try {
      await ask('motivation');
      const reply = normalize(await ask('Projekte'));
      expect(reply).toContain(text(LEISURE, 'de').slice(0, 40));
      expect(reply).not.toContain(text(HOMELAB_MOTIVATION, 'de').slice(0, 40));
      expect(modelCalls()).toBe(0);
    } finally {
      await window.happyDOM.close();
    }
  });

  it('answers a clicked option by its id', async () => {
    const { window, ask, click, modelCalls } = await chat();
    try {
      await ask('motivation');
      const reply = normalize(await click('Homelab'));
      expect(reply).toContain(text(HOMELAB_MOTIVATION, 'en').slice(0, 40));
      expect(modelCalls()).toBe(0);
    } finally {
      await window.happyDOM.close();
    }
  });
});
