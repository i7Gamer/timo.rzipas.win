import { Window } from 'happy-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { documentAnswer, facts, isReviewedSourceHref } from './catalog';
import { setupAskWork } from './browser';

const SPOTIFY_PR = 'https://github.com/i7Gamer/SpotifyTracker/pull/44';
const TUTTO_PR = 'https://github.com/i7Gamer/Tutto/pull/14';
const PETS = '/ask-pets.txt';

describe('reviewed source links', () => {
  it.each([
    SPOTIFY_PR,
    TUTTO_PR,
    PETS,
    '/downloads/timo-rzipa-cv-en.pdf#page=1',
  ])('accepts the catalogue address %j', (href) => {
    expect(isReviewedSourceHref(href)).toBe(true);
  });

  it.each([
    'https://github.com/i7Gamer/SpotifyTracker/pull/45',
    'https://github.com/i7Gamer/SpotifyTracker/pull/44?x=1',
    'https://example.com/',
    'http://github.com/i7Gamer/SpotifyTracker/pull/44',
    '/ask-pets.txt#x',
    'javascript:alert(1)',
  ])('rejects %j', (href) => {
    expect(isReviewedSourceHref(href)).toBe(false);
  });
});

describe('reviewed links in the chat', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ['spotify-compare-performance', SPOTIFY_PR],
    ['tutto-online-compatibility', TUTTO_PR],
  ])('renders %s with a clickable, focusable source', async (id, href) => {
    const fact = facts.find((entry) => entry.id === id);
    if (!fact) return expect.fail(`missing fact ${id}`);
    const window = new Window({ url: 'http://127.0.0.1:4511/' });
    try {
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>(async (input) =>
          String(input) === '/ask-content-en.json'
            ? Response.json({ locale: 'en', pages: [] })
            : Response.json(
                documentAnswer([fact], 'answer', 'local', 'en', 'fixture'),
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
      panel.querySelector('textarea')!.value = 'Is he left-handed?';
      panel
        .querySelector('form')!
        .dispatchEvent(new window.Event('submit') as unknown as Event);
      await vi.waitFor(() =>
        expect(panel.querySelector(`a[href="${href}"]`)).not.toBeNull(),
      );
      const link = panel.querySelector<HTMLAnchorElement>(`a[href="${href}"]`)!;
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      expect(link.getAttribute('tabindex')).toBeNull();
      expect(panel.querySelector('[data-ask-attribution]')).toBeNull();
    } finally {
      await window.happyDOM.close();
    }
  });
});
