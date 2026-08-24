import { describe, expect, it } from 'vitest';

import { parseStatusPayload, STATUS_DOT_CLASS } from './status';

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
