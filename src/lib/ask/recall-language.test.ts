import { Window } from 'happy-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { documentAnswer, facts } from './catalog';
import { setupAskWork } from './browser';

const GERMAN_QUESTION = 'Wofür hat Timo Flask eingesetzt?';

async function chat() {
  const window = new Window({ url: 'http://127.0.0.1:4511/' });
  const flask = facts.find(({ id }) => id === 'spotify-python')!;
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (input) =>
      String(input).startsWith('/ask-content-')
        ? Response.json({
            locale: String(input).includes('-de') ? 'de' : 'en',
            pages: [],
          })
        : Response.json(
            documentAnswer([flask], 'answer', 'local', 'de', 'fixture'),
          ),
    ),
  );
  vi.stubGlobal('document', window.document);
  window.document.documentElement.lang = 'en';
  window.document.body.innerHTML = `<section data-mode="local" data-version="fixture"><div data-ask-result></div><form><textarea></textarea><button type="submit">Ask</button></form></section>`;
  const panel = window.document.querySelector(
    'section',
  )! as unknown as HTMLElement;
  panel.dataset.messages = JSON.stringify({ wait: '…' });
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
  return { window, ask };
}

describe('chat recall keeps the original language', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ['What was your last answer?', 'answer'],
    ['What did I ask first?', 'question'],
  ])('labels %j with the recalled text language', async (recall) => {
    const { window, ask } = await chat();
    try {
      const german = await ask(GERMAN_QUESTION);
      expect(german.getAttribute('lang')).toBe('de');
      const recalled = await ask(recall);
      expect(recalled.getAttribute('lang')).toBe('de');
    } finally {
      await window.happyDOM.close();
    }
  });

  it('labels a missing recall in the current language', async () => {
    const { window, ask } = await chat();
    try {
      const recalled = await ask('What was your first answer?');
      expect(recalled.getAttribute('lang')).toBe('en');
    } finally {
      await window.happyDOM.close();
    }
  });
});
