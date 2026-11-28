import { Window } from 'happy-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Locale } from '../../i18n';
import { documentAnswer, facts, type AskResult } from './catalog';
import { setupAskWork } from './browser';

const TUTORING_HREF = '/about/#tutoring';
const fact = (id: string) => facts.find((entry) => entry.id === id)!;
const answerOf = (ids: readonly string[], locale: Locale): AskResult =>
  documentAnswer(ids.map(fact), 'answer', 'local', locale, 'fixture');

type Sent = { question: string; history?: { question: string }[] };

/** A chat whose gateway answers every question with the given facts. */
async function chat(ids: readonly string[] = ['tutoring']) {
  const window = new Window({ url: 'http://127.0.0.1:4511/' });
  const sent: Sent[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.startsWith('/ask-content-'))
        return Response.json({
          locale: url.includes('-de') ? 'de' : 'en',
          pages: [],
        });
      const body = JSON.parse(String(init?.body ?? '{}')) as Sent & {
        locale?: Locale;
      };
      sent.push(body);
      return Response.json(answerOf(ids, body.locale ?? 'en'));
    }),
  );
  vi.stubGlobal('document', window.document);
  window.document.documentElement.lang = 'en';
  window.document.body.innerHTML = `<section data-mode="local" data-version="fixture"><div data-ask-result></div><form><textarea></textarea><button type="submit">Ask</button></form></section>`;
  const panel = window.document.querySelector(
    'section',
  )! as unknown as HTMLElement;
  panel.dataset.messages = JSON.stringify({ wait: '…', partial: 'Partly.' });
  setupAskWork(panel);
  const replies = () => [...panel.querySelectorAll('[data-ask-reply]')];
  const ask = async (question: string) => {
    const before = replies().length;
    panel.querySelector('textarea')!.value = question;
    panel
      .querySelector('form')!
      .dispatchEvent(new window.Event('submit') as unknown as Event);
    await vi.waitFor(() => {
      const reply = replies()[before];
      expect(reply?.textContent).toBeTruthy();
      expect(reply?.textContent).not.toBe('…');
    });
    return replies()[before]!;
  };
  const links = (reply: Element) =>
    [...reply.querySelectorAll('a')].map((link) => link.getAttribute('href'));
  return { window, ask, sent, links };
}

describe('browser follow-ups after a non-project answer', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ['Did Timo tutor beginners?', 'And which institution was that at?'],
    ['Hat Timo Anfänger unterrichtet?', 'Und an welcher Hochschule war das?'],
  ])('forwards %j → %j to the gateway', async (first, next) => {
    const { window, ask, sent } = await chat();
    try {
      await ask(first);
      await ask(next);
      expect(sent).toHaveLength(2);
      expect(sent[1].question).toContain(next.split(' ').at(-1)!.slice(0, -1));
      expect(sent[1].history?.map(({ question }) => question)).toContain(first);
    } finally {
      await window.happyDOM.close();
    }
  });

  it('still forwards the follow-up after a thank-you', async () => {
    const { window, ask, sent } = await chat();
    try {
      await ask('Did Timo tutor beginners?');
      await ask('Thanks');
      await ask('And which institution was that at?');
      expect(sent).toHaveLength(2);
    } finally {
      await window.happyDOM.close();
    }
  });

  it('does not carry the old subject into an explicit subject change', async () => {
    const { window, ask, sent } = await chat();
    try {
      await ask('Did Timo tutor beginners?');
      await ask('New topic: what is it written in?');
      expect(sent).toHaveLength(2);
      expect(sent[1].question).toBe('New topic: what is it written in?');
    } finally {
      await window.happyDOM.close();
    }
  });

  it('asks which subject is meant when the answer had several', async () => {
    const { window, ask, sent } = await chat(['spotify-python', 'tutto-stack']);
    try {
      await ask('Which projects use Python or Flutter?');
      const reply = await ask('And what database does it use?');
      expect(sent).toHaveLength(1);
      expect(reply.textContent).toMatch(/SpotifyTracker/);
    } finally {
      await window.happyDOM.close();
    }
  });
});

describe('recalled answers keep their sources', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ['Did Timo tutor beginners?', 'What was your previous answer?'],
    ['Hat Timo Anfänger unterrichtet?', 'What was your previous answer?'],
    ['Hat Timo Anfänger unterrichtet?', 'Was war deine letzte Antwort?'],
  ])('shows the citation again: %j → %j', async (first, recall) => {
    const { window, ask, links } = await chat();
    try {
      const original = await ask(first);
      const recalled = await ask(recall);
      expect(links(original)).toEqual([TUTORING_HREF]);
      expect(links(recalled)).toEqual([TUTORING_HREF]);
      expect(recalled.getAttribute('lang')).toBe(original.getAttribute('lang'));
      expect(recalled.textContent).toContain(
        fact('tutoring').answer[original.getAttribute('lang') as Locale],
      );
    } finally {
      await window.happyDOM.close();
    }
  });

  it('shows the source again when going back to an earlier topic', async () => {
    const { window, ask, links } = await chat();
    try {
      await ask('Did Timo tutor beginners?');
      await ask('Thanks');
      const back = await ask('Back to Code Base Camp');
      expect(links(back)).toEqual([TUTORING_HREF]);
    } finally {
      await window.happyDOM.close();
    }
  });

  it('recalls a question as plain text without sources', async () => {
    const { window, ask, links } = await chat();
    try {
      await ask('Did Timo tutor beginners?');
      const recalled = await ask('What did I ask first?');
      expect(recalled.textContent).toBe('Did Timo tutor beginners?');
      expect(links(recalled)).toEqual([]);
    } finally {
      await window.happyDOM.close();
    }
  });
});
