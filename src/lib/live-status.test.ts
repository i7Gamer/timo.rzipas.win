// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  applyStatuses,
  loadLiveStatus,
  markStaleData,
  startLiveStatus,
  STATUS_REFRESH_MS,
  STATUS_REQUEST_TIMEOUT_MS,
} from './live-status';
import {
  STATUS_DOT_CLASS,
  STATUS_FUTURE_TOLERANCE_MS,
  STATUS_STALE_AFTER_MINUTES,
} from './status';

const LABELS = { online: 'online', offline: 'offline', unknown: 'unknown' };

function card(name: string, status: 'online' | 'planned' = 'online'): string {
  return `<article data-service="${name}" data-planned="${status === 'planned'}">
    <span data-status-dot class="size-1.5 rounded-full ${STATUS_DOT_CLASS[status]}"></span>
    <span data-status-label>${status}</span>
  </article>`;
}

function grid(html: string): HTMLElement {
  document.body.innerHTML = `<div data-status-grid data-label-online="online" data-label-offline="offline" data-label-unknown="unknown">${html}</div>
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
  vi.useRealTimers();
  vi.restoreAllMocks();
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

  it('preserves planned services when the payload does not mention them', () => {
    const root = grid(card('Plex') + card('Grafana', 'planned'));
    applyStatuses(root, { services: { Plex: 'online' } }, LABELS);
    expect(labelOf('Grafana')).toBe('planned');
    expect(dotOf('Grafana').contains(STATUS_DOT_CLASS.planned)).toBe(true);
  });

  it('keeps planned services planned even if the payload names them', () => {
    const root = grid(card('Grafana', 'planned'));
    applyStatuses(root, { services: { Grafana: 'online' } }, LABELS);
    expect(labelOf('Grafana')).toBe('planned');
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

  it('marks unverified services unknown for a malformed payload', () => {
    const root = grid(card('Plex'));
    expect(applyStatuses(root, 'nonsense', LABELS)).toBe(1);
    expect(labelOf('Plex')).toBe('unknown');
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

  it('marks stale readings unknown and shows their as-of note', async () => {
    const root = grid(card('Plex'));
    const asOf = document.querySelector('[data-status-asof]') as HTMLElement;
    stubFetch({
      generatedAt: '2026-08-24T15:00:00Z',
      services: { Plex: 'offline' },
    });
    await loadLiveStatus(root, asOf, new Date('2026-08-24T16:00:00Z'));
    expect(labelOf('Plex')).toBe('unknown');
    expect(asOf.hidden).toBe(false);
    expect(fetch).toHaveBeenCalledWith(
      '/status.json',
      expect.objectContaining({
        cache: 'no-store',
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it.each([
    [STATUS_FUTURE_TOLERANCE_MS, 'online'],
    [STATUS_FUTURE_TOLERANCE_MS + 1, 'unknown'],
    [-STATUS_STALE_AFTER_MINUTES * STATUS_REFRESH_MS, 'online'],
    [-STATUS_STALE_AFTER_MINUTES * STATUS_REFRESH_MS - 1, 'unknown'],
  ])('handles freshness boundary %s ms', async (offset, expected) => {
    const root = grid(card('Plex'));
    const now = new Date('2026-09-07T09:00:00Z');
    stubFetch({
      generatedAt: new Date(now.getTime() + Number(offset)).toISOString(),
      services: { Plex: 'online' },
    });
    await loadLiveStatus(root, null, now);
    expect(labelOf('Plex')).toBe(expected);
  });

  it('shows unknown when status.json is missing', async () => {
    const root = grid(card('Plex'));
    stubFetch(null, false);
    await loadLiveStatus(root, null, new Date());
    expect(labelOf('Plex')).toBe('unknown');
  });

  it('works without an as-of element', async () => {
    const root = grid(card('Plex'));
    stubFetch({
      generatedAt: '2000-01-01T00:00:00Z',
      services: { Plex: 'offline' },
    });
    await loadLiveStatus(root, null, new Date('2000-01-01T00:01:00Z'));
    expect(labelOf('Plex')).toBe('offline');
  });

  it('shows unknown after a network failure', async () => {
    const root = grid(card('Plex'));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('offline');
      }),
    );
    await expect(
      loadLiveStatus(root, null, new Date()),
    ).resolves.toBeUndefined();
    expect(labelOf('Plex')).toBe('unknown');
  });

  it.each([
    {},
    { generatedAt: 'invalid' },
    { generatedAt: '2099-01-01T00:00:00Z' },
  ])('does not trust statuses with timestamp %j', async (timestamp) => {
    const root = grid(card('Plex'));
    stubFetch({ ...timestamp, services: { Plex: 'offline' } });
    await loadLiveStatus(root, null, new Date('2026-09-07T09:00:00Z'));
    expect(labelOf('Plex')).toBe('unknown');
  });

  it('resets omitted and malformed service entries instead of keeping earlier results', async () => {
    const root = grid(card('Plex') + card('Sonarr') + card('Bulk storage'));
    stubFetch({
      generatedAt: '2026-09-07T09:00:00Z',
      services: { Plex: 'offline', Sonarr: 'broken' },
    });
    await loadLiveStatus(root, null, new Date('2026-09-07T09:01:00Z'));
    expect(labelOf('Plex')).toBe('offline');
    expect(labelOf('Sonarr')).toBe('unknown');
    expect(labelOf('Bulk storage')).toBe('unknown');
  });

  it('recovers from stale data and clears the old warning', async () => {
    const root = grid(card('Plex'));
    const asOf = document.querySelector('[data-status-asof]') as HTMLElement;
    const now = new Date('2026-09-07T09:00:00Z');
    stubFetch({
      generatedAt: '2026-09-07T08:00:00Z',
      services: { Plex: 'online' },
    });
    await loadLiveStatus(root, asOf, now);
    expect(asOf.hidden).toBe(false);
    stubFetch({ generatedAt: now.toISOString(), services: { Plex: 'online' } });
    await loadLiveStatus(root, asOf, now);
    expect(labelOf('Plex')).toBe('online');
    expect(asOf.hidden).toBe(true);
    expect(asOf.textContent).toBe('');
  });

  it('handles a JSON decoding failure', async () => {
    const root = grid(card('Plex'));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => {
          throw new SyntaxError('invalid JSON');
        },
      })),
    );
    await loadLiveStatus(root, null);
    expect(labelOf('Plex')).toBe('unknown');
  });

  it('times out hung requests and marks statuses unknown', async () => {
    vi.useFakeTimers();
    const root = grid(card('Plex'));
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url, { signal }) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () =>
              reject(new Error('aborted')),
            );
          }),
      ),
    );
    const request = loadLiveStatus(root, null);
    await vi.advanceTimersByTimeAsync(STATUS_REQUEST_TIMEOUT_MS);
    await request;
    expect(labelOf('Plex')).toBe('unknown');
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('startLiveStatus', () => {
  it('does not overlap requests or fetch because a tab became hidden', async () => {
    vi.useFakeTimers();
    const root = grid(card('Plex'));
    let resolveResponse!: (response: unknown) => void;
    const fetchMock = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveResponse = resolve;
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const stop = startLiveStatus(root, null);
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('pageshow'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveResponse({ ok: false });
    await vi.advanceTimersByTimeAsync(0);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    stop();
  });
  it('refreshes immediately and periodically, and removes timers/listeners when stopped', async () => {
    vi.useFakeTimers();
    const now = new Date('2026-09-07T09:00:00Z');
    vi.setSystemTime(now);
    const root = grid(card('Plex'));
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        generatedAt: now.toISOString(),
        services: { Plex: 'offline' },
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const stop = startLiveStatus(root, null);
    await vi.advanceTimersByTimeAsync(0);
    expect(labelOf('Plex')).toBe('offline');
    await vi.advanceTimersByTimeAsync(STATUS_REFRESH_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    stop();
    await vi.advanceTimersByTimeAsync(STATUS_REFRESH_MS);
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('pageshow'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('expires old data on an open page and refreshes on visibility/pageshow', async () => {
    vi.useFakeTimers();
    const now = new Date('2026-09-07T09:00:00Z');
    vi.setSystemTime(now);
    const root = grid(card('Plex'));
    const asOf = document.querySelector('[data-status-asof]') as HTMLElement;
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        generatedAt: now.toISOString(),
        services: { Plex: 'online' },
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    const stop = startLiveStatus(root, asOf);
    await vi.advanceTimersByTimeAsync(0);
    expect(labelOf('Plex')).toBe('online');
    const staleMinutes = 16;
    await vi.advanceTimersByTimeAsync(STATUS_REFRESH_MS * staleMinutes);
    expect(labelOf('Plex')).toBe('unknown');
    expect(asOf.hidden).toBe(false);
    const calls = fetchMock.mock.calls.length;
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(calls + 1);
    window.dispatchEvent(new Event('pagehide'));
    await vi.advanceTimersByTimeAsync(STATUS_REFRESH_MS);
    expect(fetchMock).toHaveBeenCalledTimes(calls + 1);
    window.dispatchEvent(new Event('pageshow'));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(calls + 2);
    stop();
  });
});
