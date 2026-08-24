import { describe, expect, it } from 'vitest';

import {
  isStale,
  parseGeneratedAt,
  parseStatusPayload,
  STATUS_DOT_CLASS,
  STATUS_STALE_AFTER_MINUTES,
} from './status';

describe('parseStatusPayload', () => {
  it('extracts valid service statuses', () => {
    const result = parseStatusPayload({
      generatedAt: '2026-08-24T12:00:00Z',
      services: { Plex: 'online', Sonarr: 'offline' },
    });
    expect(result.get('Plex')).toBe('online');
    expect(result.get('Sonarr')).toBe('offline');
    expect(result.size).toBe(2);
  });

  it('ignores unknown status values', () => {
    const result = parseStatusPayload({
      services: { A: 'online', B: 'degraded', C: 5, D: null },
    });
    expect([...result.keys()]).toEqual(['A']);
  });

  it.each([null, undefined, 'text', 42, [], {}])(
    'returns an empty map for invalid payload %j',
    (payload) => {
      expect(parseStatusPayload(payload).size).toBe(0);
    },
  );

  it.each([null, 'online', ['online']])(
    'returns an empty map when services is %j',
    (services) => {
      expect(parseStatusPayload({ services }).size).toBe(0);
    },
  );

  it('provides a dot class for every indicator status', () => {
    expect(STATUS_DOT_CLASS.online).toMatch(/^bg-/);
    expect(STATUS_DOT_CLASS.planned).toMatch(/^bg-/);
    expect(STATUS_DOT_CLASS.offline).toMatch(/^bg-/);
  });
});

describe('parseGeneratedAt', () => {
  it('parses a valid ISO timestamp', () => {
    const date = parseGeneratedAt({
      generatedAt: '2026-08-24T15:00:00.000Z',
      services: {},
    });
    expect(date?.toISOString()).toBe('2026-08-24T15:00:00.000Z');
  });

  it.each([
    null,
    'text',
    {},
    { generatedAt: 42 },
    { generatedAt: 'not a date' },
  ])('returns null for %j', (payload) => {
    expect(parseGeneratedAt(payload)).toBeNull();
  });
});

describe('isStale', () => {
  const generated = new Date('2026-08-24T15:00:00Z');

  it('treats fresh data as not stale', () => {
    const now = new Date('2026-08-24T15:05:00Z');
    expect(isStale(generated, now, STATUS_STALE_AFTER_MINUTES)).toBe(false);
  });

  it('treats data older than the threshold as stale', () => {
    const now = new Date('2026-08-24T15:16:00Z');
    expect(isStale(generated, now, STATUS_STALE_AFTER_MINUTES)).toBe(true);
  });

  it('is not stale exactly at the threshold', () => {
    const now = new Date('2026-08-24T15:15:00Z');
    expect(isStale(generated, now, STATUS_STALE_AFTER_MINUTES)).toBe(false);
  });

  it('treats clock skew into the future as fresh', () => {
    const now = new Date('2026-08-24T14:50:00Z');
    expect(isStale(generated, now, STATUS_STALE_AFTER_MINUTES)).toBe(false);
  });
});
