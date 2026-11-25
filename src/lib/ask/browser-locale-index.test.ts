import { Window } from 'happy-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setupAskWork } from './browser';

describe('language-specific offline index paths', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses the question language fixed index when a shared locale cookie is stale', async () => {
    const window = new Window();
    try {
      vi.stubGlobal('document', window.document);
      window.document.documentElement.lang = 'en';
      window.document.cookie = 'locale=de';
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
