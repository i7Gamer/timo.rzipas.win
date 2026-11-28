import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  MAX_RANKED_FACTS,
  rankedCandidates,
} from '../../../services/ask/granite.ts';
import { facts } from './catalog';
import { corpusVersion } from './version';

const pool = facts
  .filter(({ id }) => id.startsWith('spotify-'))
  .map(({ id }) => id);
const rankWith = (ids: string[]) => async () => ({ corpusVersion, ids });
const ranked = (ids: string[]) =>
  rankedCandidates(
    rankWith(ids),
    'How does SpotifyTracker work?',
    'en',
    pool,
    AbortSignal.timeout(1_000),
  );

describe('Granite ranked candidates', () => {
  it('passes up to four ranked facts to the selector, in ranked order', async () => {
    expect(MAX_RANKED_FACTS).toBe(4);
    const ids = pool.slice(0, MAX_RANKED_FACTS).reverse();
    expect((await ranked(ids)).map(({ id }) => id)).toEqual(ids);
  });

  it('rejects a ranking longer than the limit', async () => {
    expect(pool.length).toBeGreaterThan(MAX_RANKED_FACTS);
    expect(await ranked(pool.slice(0, MAX_RANKED_FACTS + 1))).toEqual([]);
  });

  it('matches the result limit of the Python worker', () => {
    const worker = readFileSync(
      new URL('../../../services/ask/granite.py', import.meta.url),
      'utf8',
    );
    expect(worker).toMatch(
      new RegExp(`^MAX_RESULTS = ${MAX_RANKED_FACTS}$`, 'm'),
    );
  });
});
