import { request, type Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  RESCUED_FACTS,
  withRescue,
  type RankFacts,
} from '../../../services/ask/granite.ts';
import {
  MAX_CANDIDATES,
  prepareQuestion,
  type SelectFacts,
} from '../../../services/ask/selection.ts';
import { createGateway } from '../../../services/ask/server.ts';
import { facts } from './catalog';
import { topicCandidates } from './topics';
import { corpusVersion } from './version';

const HTL_CHAT =
  'Could classmates chat live on the site Timo made at HTL Dornbirn?';
const SUPERVISOR_DONE =
  'If a Hearthcoil coding agent says it is finished, does that count as a passed test in the supervisor?';
const HTL_SITE = 'htl-dornbirn-class-website';
const SUPERVISOR = 'hearthcoil-supervisor-verification';
const TEST_SIGNAL_MS = 2_000;
const SHORT_BUDGET_MS = 10;
const fact = (id: string) => facts.find((entry) => entry.id === id)!;
const rescuePool = (question: string) =>
  prepareQuestion(question, 'en').rescuePool ?? [];

describe('rescue pool for weak keyword evidence', () => {
  it.each([
    [HTL_CHAT, HTL_SITE, ['spotify-', 'hearthcoil-']],
    [SUPERVISOR_DONE, SUPERVISOR, ['spotify-', 'htl-']],
  ])(
    'offers the named topic’s facts for %j',
    (question, expected, otherTopics) => {
      const { candidates } = prepareQuestion(question, 'en');
      const pool = rescuePool(question);
      expect(candidates.length).toBeGreaterThan(0);
      expect(pool).toContain(expected);
      for (const { id } of candidates) expect(pool).not.toContain(id);
      for (const prefix of otherTopics)
        expect(pool.some((id) => id.startsWith(prefix))).toBe(false);
    },
  );

  it.each([
    'How does Tutto sync its rooms?',
    'Which payment method does the Abacus workflow create when it is missing?',
    // "accounts" is also part of the topic "accounts receivable".
    'How are accounts and music data organised in SpotifyTracker?',
    'Which methods can the thesis tool use to analyse a schedule?',
  ])('keeps strict evidence alone when its aliases match: %j', (question) => {
    expect(prepareQuestion(question, 'en').candidates.length).toBeGreaterThan(
      0,
    );
    expect(rescuePool(question)).toEqual([]);
  });

  it('never widens a question that names no topic', () => {
    expect(rescuePool('Could classmates chat live on the site?')).toEqual([]);
  });
});

const rankWith =
  (ids: readonly string[]): RankFacts =>
  async () => ({ corpusVersion, ids: [...ids] });
const rescue = (
  rank: RankFacts,
  candidates: readonly string[],
  pool: readonly string[],
  signal = AbortSignal.timeout(TEST_SIGNAL_MS),
  budgetMs?: number,
) =>
  withRescue(
    rank,
    HTL_CHAT,
    'en',
    candidates.map(fact),
    pool,
    signal,
    budgetMs,
  ).then((selected) => selected.map(({ id }) => id));

describe('withRescue', () => {
  const htlPool = facts
    .filter(({ sourceId }) => sourceId === 'htl-dornbirn')
    .map(({ id }) => id);

  it('appends the best ranked facts the candidates lack', async () => {
    expect(
      await rescue(rankWith([HTL_SITE]), ['cv-matura'], [HTL_SITE]),
    ).toEqual(['cv-matura', HTL_SITE]);
  });

  it(`adds at most ${RESCUED_FACTS} facts and skips duplicates`, async () => {
    const pool = [HTL_SITE, 'cv-matura', ...htlPool];
    const ranked = [...new Set(pool)].slice(0, RESCUED_FACTS + 1);
    const selected = await rescue(rankWith(ranked), ['cv-matura'], pool);
    expect(selected[0]).toBe('cv-matura');
    expect(selected.length).toBeLessThanOrEqual(1 + RESCUED_FACTS);
    expect(new Set(selected).size).toBe(selected.length);
  });

  it('keeps the candidate list within the selector limit', async () => {
    const many = facts
      .filter(({ id }) => id.startsWith('spotify-'))
      .slice(0, MAX_CANDIDATES)
      .map(({ id }) => id);
    const selected = await rescue(rankWith([HTL_SITE]), many, [HTL_SITE]);
    expect(selected).toHaveLength(MAX_CANDIDATES);
    expect(selected.at(-1)).toBe(HTL_SITE);
  });

  it('puts rescued facts before broad topic candidates', async () => {
    const topics = topicCandidates().slice(0, 2);
    const selected = await withRescue(
      rankWith([HTL_SITE]),
      HTL_CHAT,
      'en',
      topics,
      [HTL_SITE],
      AbortSignal.timeout(TEST_SIGNAL_MS),
    );
    expect(selected.map(({ id }) => id)).toEqual([
      HTL_SITE,
      ...topics.map(({ id }) => id),
    ]);
  });

  it('does not call the ranker without a rescue pool', async () => {
    const rank = vi.fn(rankWith([HTL_SITE]));
    expect(await rescue(rank, ['cv-matura'], [])).toEqual(['cv-matura']);
    expect(rank).not.toHaveBeenCalled();
  });

  it('keeps the candidates when the ranker finds nothing new', async () => {
    expect(await rescue(rankWith([]), ['cv-matura'], [HTL_SITE])).toEqual([
      'cv-matura',
    ]);
  });

  it('keeps the candidates when the ranker exceeds its budget', async () => {
    const stalled: RankFacts = (_q, _l, _a, signal) =>
      new Promise((_, reject) =>
        signal.addEventListener('abort', () => reject(signal.reason)),
      );
    expect(
      await rescue(
        stalled,
        ['cv-matura'],
        [HTL_SITE],
        AbortSignal.timeout(TEST_SIGNAL_MS),
        SHORT_BUDGET_MS,
      ),
    ).toEqual(['cv-matura']);
  });

  it('still fails when the request itself is aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      rescue(
        rankWith([HTL_SITE]),
        ['cv-matura'],
        [HTL_SITE],
        controller.signal,
      ),
    ).rejects.toThrow();
  });
});

describe('gateway rescue pass', () => {
  let gateway: Server | undefined;
  afterEach(async () => {
    if (gateway)
      await new Promise<void>((resolve) => gateway!.close(() => resolve()));
    gateway = undefined;
  });

  async function evidenceFor(question: string, rank?: RankFacts) {
    let evidence: string[] = [];
    const select: SelectFacts = async (_q, _l, candidates) => {
      evidence = candidates.map(({ id }) => id);
      return { status: 'unknown', slots: [] };
    };
    gateway = createGateway({ select, rank });
    await new Promise<void>((resolve) =>
      gateway!.listen(0, '127.0.0.1', resolve),
    );
    const address = gateway.address();
    if (!address || typeof address === 'string') throw new Error('no address');
    await new Promise<void>((resolve, reject) => {
      const req = request(
        {
          host: '127.0.0.1',
          port: address.port,
          path: '/api/ask',
          method: 'POST',
          headers: {
            Host: '127.0.0.1:4511',
            Origin: 'http://127.0.0.1:4511',
            'Content-Type': 'application/json',
          },
        },
        (response) => response.resume().on('end', resolve),
      ).on('error', reject);
      req.end(JSON.stringify({ question, locale: 'en' }));
    });
    return evidence;
  }

  it('gives the selector the rescued fact beside the weak hit', async () => {
    const evidence = await evidenceFor(HTL_CHAT, rankWith([HTL_SITE]));
    expect(evidence).toContain(HTL_SITE);
  });

  it('keeps the strict candidates without a ranker', async () => {
    const evidence = await evidenceFor(HTL_CHAT);
    expect(evidence).not.toContain(HTL_SITE);
    expect(evidence.length).toBeGreaterThan(0);
  });
});
