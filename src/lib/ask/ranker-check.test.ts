import { describe, expect, it, vi } from 'vitest';
import { assertRankerCorpus } from '../../../tests/ask/ranker-check.ts';
import { corpusVersion } from './version';

const signal = () => AbortSignal.timeout(1_000);

describe('ranker corpus check', () => {
  it('accepts a ranker built from the current facts', async () => {
    const rank = vi.fn(async () => ({ corpusVersion, ids: [] }));
    await expect(assertRankerCorpus(rank, signal())).resolves.toBeUndefined();
    expect(rank).toHaveBeenCalledOnce();
  });

  it('names both versions when the ranker is stale', async () => {
    const rank = async () => ({ corpusVersion: 'old-corpus', ids: [] });
    await expect(assertRankerCorpus(rank, signal())).rejects.toThrow(
      new RegExp(`old-corpus.*${corpusVersion}.*restart`, 's'),
    );
  });

  it.each([
    ['no reply', null],
    ['a reply without a version', { ids: [] }],
  ])('rejects %s', async (_, reply) => {
    await expect(
      assertRankerCorpus(async () => reply, signal()),
    ).rejects.toThrow(/ranker/i);
  });

  it('reports an unreachable ranker', async () => {
    const rank = async () => {
      throw new Error('connect ECONNREFUSED');
    };
    await expect(assertRankerCorpus(rank, signal())).rejects.toThrow(
      /ranker.*ECONNREFUSED/s,
    );
  });
});
