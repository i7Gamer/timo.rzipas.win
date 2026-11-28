import { Window } from 'happy-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { documentAnswer, expandedSummaries, facts, normalize } from './catalog';
import { resolveChoice, unknownReply } from './conversation';
import { setupAskWork } from './browser';
import { profileQuestionChoices } from './reviewed-questions';
import { TOPIC_PROMPTS } from './topics';

const MOTIVATION = [
  {
    id: 'homelab',
    label: 'Homelab',
    names: ['Homelab'],
    ids: ['homelab-motivation'],
  },
  {
    id: 'projects',
    label: 'Projects',
    names: ['Projects', 'Projekte'],
    ids: ['portfolio-leisure'],
  },
] as const;

describe('clarification choices', () => {
  it.each([
    ['en', 'motivation', ['Homelab', 'Projects']],
    ['de', 'motivation', ['Homelab', 'Projekte']],
    ['en', 'longer summary please', ['CV', 'Work experience', 'Projects']],
    [
      'de',
      'längere Zusammenfassung',
      ['Lebenslauf', 'Berufserfahrung', 'Projekte'],
    ],
  ] as const)('offers %s choices for %j', (locale, question, labels) => {
    expect(
      profileQuestionChoices(normalize(question), locale)?.map(
        ({ label }) => label,
      ),
    ).toEqual(labels);
  });

  it('links summary choices to the reviewed longer summaries', () => {
    expect(
      profileQuestionChoices('longer summary please', 'en')?.[0].ids,
    ).toEqual(expandedSummaries['longer summary of his cv']);
  });

  it('has no choices for open clarifications', () => {
    expect(profileQuestionChoices('weaknesses', 'en')).toBeUndefined();
    expect(profileQuestionChoices('cv', 'en')).toBeUndefined();
  });

  it.each([
    ['both', ['homelab-motivation', 'portfolio-leisure']],
    ['beides', ['homelab-motivation', 'portfolio-leisure']],
    ['Beide bitte', ['homelab-motivation', 'portfolio-leisure']],
    ['all of them', ['homelab-motivation', 'portfolio-leisure']],
    ['homelab', ['homelab-motivation']],
    ['the homelab one', ['homelab-motivation']],
    ['the first one', ['homelab-motivation']],
    ['das zweite', ['portfolio-leisure']],
    ['2', ['portfolio-leisure']],
    ['Projects', ['portfolio-leisure']],
  ])('resolves %j', (answer, expected) => {
    expect(resolveChoice(answer, MOTIVATION)).toEqual(expected);
  });

  it.each(['What is Hearthcoil?', 'neither', 'third', ''])(
    'leaves %j as a new question',
    (answer) => {
      expect(resolveChoice(answer, MOTIVATION)).toBeUndefined();
    },
  );

  it('removes duplicate facts when choices overlap', () => {
    expect(
      resolveChoice('both', [
        { id: 'a', label: 'A', names: ['A'], ids: ['cv-degree', 'cv-matura'] },
        { id: 'b', label: 'B', names: ['B'], ids: ['cv-matura', 'tutoring'] },
      ]),
    ).toEqual(['cv-degree', 'cv-matura', 'tutoring']);
  });
});

describe('fallback copy', () => {
  it('never asks the visitor to name a machine', () => {
    for (const locale of ['en', 'de'] as const)
      for (const index of [0, 1])
        expect(unknownReply(locale, index)).not.toMatch(/Rechner|machine/);
  });
});

function chatPanel(window: Window, mode: 'local' | 'index' = 'local') {
  vi.stubGlobal('document', window.document);
  window.document.documentElement.lang = 'en';
  window.document.body.innerHTML = `<section data-mode="${mode}" data-version="fixture"><div data-ask-result></div><div data-ask-actions></div><form><textarea></textarea><button type="submit">Ask</button></form></section>`;
  const panel = window.document.querySelector('section')!;
  panel.dataset.messages = JSON.stringify({
    wait: 'Looking…',
    offline: 'Offline.',
  });
  setupAskWork(panel as unknown as HTMLElement);
  return panel;
}

async function submit(window: Window, panel: HTMLElement, question: string) {
  const button = panel.querySelector('button')!;
  const replies = panel.querySelectorAll('[data-ask-reply]').length;
  panel.querySelector('textarea')!.value = question;
  panel
    .querySelector('form')!
    .dispatchEvent(new window.Event('submit') as unknown as Event);
  await vi.waitFor(() =>
    expect(panel.querySelectorAll('[data-ask-reply]')).toHaveLength(
      replies + 1,
    ),
  );
  await vi.waitFor(() => expect(button.disabled).toBe(false));
  return panel.querySelectorAll('[data-ask-reply]')[replies]!;
}

const actionLabels = (panel: HTMLElement) =>
  Array.from(
    panel.querySelectorAll('[data-ask-actions] button'),
    (button) => button.textContent,
  );

const factText = (id: string) =>
  facts.find((fact) => fact.id === id)!.answer.en;

describe('choices in the chat', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubFetch(api: () => Response) {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const path = String(input);
      if (path === '/ask-content-en.json')
        return Response.json({ locale: 'en', pages: [] });
      if (path === '/api/ask') return api();
      throw new Error(`Unexpected request: ${path}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('answers “both” with every offered choice locally', async () => {
    const window = new Window({ url: 'http://127.0.0.1:4511/' });
    try {
      const fetchMock = stubFetch(() => new Response(null, { status: 503 }));
      const panel = chatPanel(window) as unknown as HTMLElement;
      const question = await submit(window, panel, 'motivation');
      expect(question.textContent).toMatch(/self-hosting/);
      expect(actionLabels(panel)).toEqual(['Homelab', 'Projects']);

      const reply = await submit(window, panel, 'both');
      expect(reply.textContent).toContain(factText('homelab-motivation'));
      expect(reply.textContent).toContain(factText('portfolio-leisure'));
      expect(
        fetchMock.mock.calls.filter(([path]) => path === '/api/ask'),
      ).toHaveLength(0);
      expect(actionLabels(panel)).not.toContain('Homelab');
    } finally {
      await window.happyDOM.close();
    }
  });

  it('answers a single picked choice', async () => {
    const window = new Window({ url: 'http://127.0.0.1:4511/' });
    try {
      stubFetch(() => new Response(null, { status: 503 }));
      const panel = chatPanel(window) as unknown as HTMLElement;
      await submit(window, panel, 'motivation');
      const reply = await submit(window, panel, 'Homelab');
      expect(reply.textContent).toContain(factText('homelab-motivation'));
      expect(reply.textContent).not.toContain(factText('portfolio-leisure'));
    } finally {
      await window.happyDOM.close();
    }
  });

  it('suggests topics when the lookup fails', async () => {
    const window = new Window({ url: 'http://127.0.0.1:4511/' });
    try {
      stubFetch(() => new Response(null, { status: 503 }));
      const panel = chatPanel(window) as unknown as HTMLElement;
      const reply = await submit(window, panel, 'Is he left-handed?');
      expect(reply.textContent).toBe('Offline.');
      expect(actionLabels(panel)).toEqual([...TOPIC_PROMPTS.en]);
    } finally {
      await window.happyDOM.close();
    }
  });

  it('suggests topics after an unknown answer', async () => {
    const window = new Window({ url: 'http://127.0.0.1:4511/' });
    try {
      stubFetch(() =>
        Response.json(documentAnswer([], 'unknown', 'local', 'en', 'fixture')),
      );
      const panel = chatPanel(window) as unknown as HTMLElement;
      await submit(window, panel, 'Who won the World Cup?');
      expect(actionLabels(panel)).toEqual([...TOPIC_PROMPTS.en]);
      await submit(window, panel, 'cv');
      expect(actionLabels(panel)).toEqual([]);
    } finally {
      await window.happyDOM.close();
    }
  });
});
