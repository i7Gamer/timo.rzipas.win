// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { applyStatuses, loadLiveStatus, markStaleData } from './live-status';
import { STATUS_DOT_CLASS } from './status';

const LABELS = { online: 'online', offline: 'offline' };

function card(name: string, status: 'online' | 'planned' = 'online'): string {
  return `<article data-service="${name}">
    <span data-status-dot class="size-1.5 rounded-full ${STATUS_DOT_CLASS[status]}"></span>
    <span data-status-label>${status}</span>
  </article>`;
}

function grid(html: string): HTMLElement {
  document.body.innerHTML = `<div data-status-grid data-label-online="online" data-label-offline="offline">${html}</div>
    <span data-status-asof data-label="(as of {time})" hidden></span>`;
  return document.querySelector('[data-status-grid]') as HTMLElement;
}

function dotOf(name: string): DOMTokenList {
  return document.querySelector(`[data-service="${name}"] [data-status-dot]`)!
    .classList;
}

function labelOf(name: string): string {
  return document.querySelector(`[data-service="${name}"] [data-status-label]`)!
    .textContent;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('applyStatuses', () => {
  it('flips the dot and label of every service the payload names', () => {
    const root = grid(card('Plex') + card('Sonarr'));
    const updated = applyStatuses(
      root,
      { services: { Plex: 'offline', Sonarr: 'online' } },
      LABELS,
    );
    expect(updated).toBe(2);
    expect(dotOf('Plex').contains(STATUS_DOT_CLASS.offline)).toBe(true);
    expect(dotOf('Plex').contains(STATUS_DOT_CLASS.online)).toBe(false);
    expect(labelOf('Plex')).toBe('offline');
    expect(dotOf('Sonarr').contains(STATUS_DOT_CLASS.online)).toBe(true);
  });

  // Names may contain quotes, so the lookup must not go through a selector.
  it('matches names with an apostrophe', () => {
    const root = grid(card("What's up Docker"));
    applyStatuses(
      root,
      { services: { "What's up Docker": 'offline' } },
      LABELS,
    );
    expect(labelOf("What's up Docker")).toBe('offline');
  });

  it('leaves services the payload does not mention alone', () => {
    const root = grid(card('Plex') + card('Grafana', 'planned'));
    applyStatuses(root, { services: { Plex: 'online' } }, LABELS);
    expect(labelOf('Grafana')).toBe('planned');
    expect(dotOf('Grafana').contains(STATUS_DOT_CLASS.planned)).toBe(true);
  });

  it('skips a card that has no dot or label', () => {
    const root = grid('<article data-service="Bare"></article>');
    expect(applyStatuses(root, { services: { Bare: 'offline' } }, LABELS)).toBe(
      0,
    );
  });

  it('falls back to the raw status when no label is configured', () => {
    const root = grid(card('Plex'));
    applyStatuses(root, { services: { Plex: 'offline' } }, {});
    expect(labelOf('Plex')).toBe('offline');
  });

  it('changes nothing for a malformed payload', () => {
    const root = grid(card('Plex'));
    expect(applyStatuses(root, 'nonsense', LABELS)).toBe(0);
    expect(labelOf('Plex')).toBe('online');
  });
});

describe('markStaleData', () => {
  const generatedAt = '2026-08-24T15:00:00Z';
  function asOf(): HTMLElement {
    grid('');
    return document.querySelector('[data-status-asof]') as HTMLElement;
  }

  it('stays hidden while the data is fresh', () => {
    const element = asOf();
    const shown = markStaleData(
      element,
      { generatedAt },
      new Date('2026-08-24T15:05:00Z'),
      'en',
    );
    expect(shown).toBe(false);
    expect(element.hidden).toBe(true);
  });

  it('shows the generation time once the data is stale', () => {
    const element = asOf();
    const shown = markStaleData(
      element,
      { generatedAt },
      new Date('2026-08-24T16:00:00Z'),
      'en',
    );
    expect(shown).toBe(true);
    expect(element.hidden).toBe(false);
    expect(element.textContent).toMatch(/^\(as of \d/);
    expect(element.textContent).not.toContain('{time}');
  });

  it('stays hidden when the payload has no usable timestamp', () => {
    const element = asOf();
    expect(markStaleData(element, {}, new Date(), 'en')).toBe(false);
    expect(element.hidden).toBe(true);
  });
});

describe('loadLiveStatus', () => {
  function stubFetch(body: unknown, ok = true): void {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok, json: async () => body })),
    );
  }

  it('applies a fetched payload and marks stale data', async () => {
    const root = grid(card('Plex'));
    const asOf = document.querySelector('[data-status-asof]') as HTMLElement;
    stubFetch({
      generatedAt: '2026-08-24T15:00:00Z',
      services: { Plex: 'offline' },
    });
    await loadLiveStatus(root, asOf, new Date('2026-08-24T16:00:00Z'));
    expect(labelOf('Plex')).toBe('offline');
    expect(asOf.hidden).toBe(false);
    expect(fetch).toHaveBeenCalledWith('/status.json', { cache: 'no-store' });
  });

  it('keeps the build-time labels when status.json is missing', async () => {
    const root = grid(card('Plex'));
    stubFetch(null, false);
    await loadLiveStatus(root, null, new Date());
    expect(labelOf('Plex')).toBe('online');
  });

  it('works without an as-of element', async () => {
    const root = grid(card('Plex'));
    stubFetch({
      generatedAt: '2000-01-01T00:00:00Z',
      services: { Plex: 'offline' },
    });
    await loadLiveStatus(root, null, new Date());
    expect(labelOf('Plex')).toBe('offline');
  });

  it('propagates a network failure for the caller to swallow', async () => {
    const root = grid(card('Plex'));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('offline');
      }),
    );
    await expect(loadLiveStatus(root, null, new Date())).rejects.toThrow();
    expect(labelOf('Plex')).toBe('online');
  });
});
