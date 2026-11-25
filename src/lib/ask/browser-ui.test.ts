import { Window } from 'happy-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import AskWork from '../../components/AskWork.astro';
import { setupAskWork } from './browser';

function fixture(window: Window) {
  vi.stubGlobal('document', window.document);
  window.document.documentElement.lang = 'en';
  window.document.body.innerHTML = `
    <section>
      <div data-ask-window-tools hidden>
        <button type="button" data-ask-collapse aria-label="Collapse"><span></span></button>
        <button type="button" data-ask-restore aria-label="Restore"><span></span></button>
      </div>
      <details data-ask-work data-mode="index" data-version="fixture" data-messages='{"wait":"Looking..."}'>
        <summary>Ask about my work</summary>
        <div id="ask-work-body" data-ask-body>
          <div data-ask-result></div>
          <form><textarea></textarea><button type="submit">Ask</button></form>
        </div>
      </details>
    </section>`;
  const panel = window.document.querySelector(
    'details',
  ) as unknown as HTMLDetailsElement;
  setupAskWork(panel as unknown as HTMLElement);
  return panel;
}

function installResizeObserver() {
  const callbacks: Array<() => void> = [];
  class FixtureResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      callbacks.push(() => callback([], this as unknown as ResizeObserver));
    }

    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', FixtureResizeObserver);
  return callbacks;
}

describe('Ask about my work UI', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('renders a native collapsed disclosure with controls and no-JS examples', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(AskWork, {
      props: { locale: 'en' },
    });
    const window = new Window();
    try {
      window.document.body.innerHTML = html;
      const details = window.document.querySelector(
        'details[data-ask-work]',
      ) as unknown as HTMLDetailsElement;
      expect(details.open).toBe(false);
      expect(details.querySelector('summary')?.textContent).toContain(
        'Ask about Timo',
      );
      expect(
        details.querySelector('[data-ask-result]')?.getAttribute('aria-label'),
      ).toBe('Conversation with Ask about Timo');
      const tools = Array.from(
        details.parentElement?.querySelectorAll(
          '[data-ask-window-tools] button',
        ) ?? [],
      );
      expect(
        tools.map((control) => control.getAttribute('aria-label')),
      ).toEqual(['Collapse conversation', 'Restore conversation']);
      expect(
        tools.every((control) => control.classList.contains('cursor-pointer')),
      ).toBe(true);
      const toolIcons = tools.map((control) => control.querySelector('svg')!);
      expect(
        toolIcons.every((icon) => icon.getAttribute('aria-hidden') === 'true'),
      ).toBe(true);
      expect(new Set(toolIcons.map((icon) => icon.innerHTML)).size).toBe(2);
      expect(details.querySelector('summary button')).toBeNull();
      expect(
        details.parentElement
          ?.querySelector('[data-ask-window-tools]')
          ?.hasAttribute('hidden'),
      ).toBe(true);
      expect(
        details.querySelector('[data-ask-static-examples]'),
      ).not.toBeNull();
      expect(
        details.querySelector('[data-ask-body]')?.hasAttribute('inert'),
      ).toBe(false);
    } finally {
      window.close();
    }
  });

  it('renders the German panel name and conversation label', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(AskWork, {
      props: { locale: 'de' },
    });
    const window = new Window();
    try {
      window.document.body.innerHTML = html;
      const details = window.document.querySelector(
        'details[data-ask-work]',
      ) as unknown as HTMLDetailsElement;
      expect(details.querySelector('summary')?.textContent).toContain(
        'Fragen zu Timo',
      );
      expect(
        details.querySelector('[data-ask-result]')?.getAttribute('aria-label'),
      ).toBe('Unterhaltung: Fragen zu Timo');
    } finally {
      window.close();
    }
  });

  it('supports collapsing and restoring the conversation panel', () => {
    const window = new Window();
    try {
      const panel = fixture(window);
      const tools = panel.parentElement!.querySelector<HTMLElement>(
        '[data-ask-window-tools]',
      )!;
      expect(tools.hidden).toBe(false);
      const collapse = tools.querySelector(
        '[data-ask-collapse]',
      ) as unknown as HTMLButtonElement;
      const restore = tools.querySelector(
        '[data-ask-restore]',
      ) as unknown as HTMLButtonElement;
      expect(restore.getAttribute('aria-expanded')).toBe('false');
      restore.click();
      expect(panel.open).toBe(true);
      expect(collapse.getAttribute('aria-expanded')).toBe('true');
      collapse.click();
      expect(panel.open).toBe(false);
      expect(restore.getAttribute('aria-expanded')).toBe('false');
    } finally {
      window.close();
    }
  });

  it('routes mixed-language questions using the question language', async () => {
    const window = new Window();
    try {
      const panel = fixture(window);
      panel.dataset.messages = JSON.stringify({
        wait: 'Looking...',
        offline: 'Offline',
      });
      panel.dataset.askOtherMessages = JSON.stringify({
        wait: 'Suche...',
        offline: 'Offline',
      });
      const fetchMock = vi.fn(async () => ({ ok: false, status: 404 }));
      vi.stubGlobal('fetch', fetchMock);
      const input = panel.querySelector('textarea')!;
      const form = panel.querySelector('form')!;
      input.value = 'Was kostet SpotifyTracker?';
      form.dispatchEvent(new window.Event('submit') as unknown as Event);
      await vi.waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
          '/ask-content-de.json',
          expect.any(Object),
        ),
      );
      await vi.waitFor(() =>
        expect(
          (form.querySelector('button') as HTMLButtonElement).disabled,
        ).toBe(false),
      );

      input.value = 'Was SpotifyTracker a rewrite?';
      form.dispatchEvent(new window.Event('submit') as unknown as Event);
      await vi.waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(
          '/ask-content-en.json',
          expect.any(Object),
        );
      });
      expect(
        panel.querySelectorAll('[data-ask-user]')[1]?.getAttribute('lang'),
      ).toBe('en');
    } finally {
      window.close();
    }
  });

  it('follows late reply reflow and resumes following on a new question', async () => {
    const window = new Window();
    try {
      const callbacks = installResizeObserver();
      const panel = fixture(window);
      const output = panel.querySelector(
        '[data-ask-result]',
      ) as unknown as HTMLElement;
      let scrollHeight = 500;
      Object.defineProperties(output, {
        scrollHeight: {
          configurable: true,
          get: () => scrollHeight,
        },
        clientHeight: { configurable: true, value: 100 },
      });

      panel.querySelector('textarea')!.value = 'Thanks!';
      panel
        .querySelector('form')!
        .dispatchEvent(new window.Event('submit') as unknown as Event);
      await vi.waitFor(() => expect(output.scrollTop).toBe(500));

      scrollHeight = 760;
      callbacks[0]();
      expect(output.scrollTop).toBe(760);

      output.scrollTop = 0;
      output.dispatchEvent(new window.Event('scroll') as unknown as Event);
      scrollHeight = 920;
      callbacks[0]();
      expect(output.scrollTop).toBe(0);

      panel.querySelector('textarea')!.value = 'Thanks again!';
      panel
        .querySelector('form')!
        .dispatchEvent(new window.Event('submit') as unknown as Event);
      await vi.waitFor(() => expect(output.scrollTop).toBe(920));
    } finally {
      window.close();
    }
  });
});
