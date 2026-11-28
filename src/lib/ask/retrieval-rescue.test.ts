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
const TUTTO_COMPOUND =
  'Can people use real dice in Tutto’s games, and what technology keeps its online rooms synchronized?';
const HEARTHCOIL_COMPOUND =
  'How often does Timo playtest Hearthcoil, and what automated check followed the launcher-hand issue?';
const BOTH_COVERED =
  'How does Tutto sync its rooms, and which payment method does the Abacus workflow create when it is missing?';
const TUTTO_STACK = 'tutto-stack';
const TUTTO_MODES = 'tutto-modes';
const HEARTHCOIL_PLAYTEST = 'hearthcoil-playtest';
const HEARTHCOIL_LAUNCHER = 'hearthcoil-launcher-playtest';
const rescueClauses = (question: string) =>
  prepareQuestion(question, 'en').rescuePool ?? [];
const rescuePool = (question: string) =>
  rescueClauses(question).flatMap(({ pool }) => pool);

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

  it('ranks a single-clause question under its whole text', () => {
    const [clause, ...others] = rescueClauses(HTL_CHAT);
    expect(others).toEqual([]);
    expect(clause.query).toBe(HTL_CHAT);
  });

  it.each([
    [TUTTO_COMPOUND, TUTTO_MODES, TUTTO_STACK],
    [HEARTHCOIL_COMPOUND, HEARTHCOIL_PLAYTEST, HEARTHCOIL_LAUNCHER],
  ])(
    'rescues the uncovered second clause of %j',
    (question, covered, expected) => {
      const { candidates } = prepareQuestion(question, 'en');
      expect(candidates.map(({ id }) => id)).toContain(covered);
      const clauses = rescueClauses(question);
      expect(clauses).toHaveLength(1);
      expect(clauses[0].query).not.toBe(question);
      expect(question).toContain(clauses[0].query);
      expect(clauses[0].pool).toContain(expected);
      for (const { id } of candidates)
        expect(clauses[0].pool).not.toContain(id);
    },
  );

  it('rescues nothing when every clause has its own strict hit', () => {
    expect(
      prepareQuestion(BOTH_COVERED, 'en').candidates.length,
    ).toBeGreaterThan(0);
    expect(rescueClauses(BOTH_COVERED)).toEqual([]);
  });

  it('widens a clause naming no topic with the topics of the question', () => {
    const [clause] = rescueClauses(TUTTO_COMPOUND);
    expect(clause.pool.every((id) => id.startsWith('tutto-'))).toBe(true);
  });

  it('widens a clause with the topics it names itself', () => {
    const question =
      'How often does Timo playtest Hearthcoil, and what did he build at HTL Dornbirn?';
    const pool = rescuePool(question);
    expect(pool).toContain(HTL_SITE);
    expect(pool.some((id) => id.startsWith('hearthcoil-'))).toBe(false);
  });
});

const rankWith =
  (ids: readonly string[]): RankFacts =>
  async () => ({ corpusVersion, ids: [...ids] });
const clausesOf = (pool: readonly string[], query = HTL_CHAT) =>
  pool.length ? [{ query, pool }] : [];
const rescue = (
  rank: RankFacts,
  candidates: readonly string[],
  pool: readonly string[],
  signal = AbortSignal.timeout(TEST_SIGNAL_MS),
  budgetMs?: number,
) =>
  withRescue(
    rank,
    'en',
    candidates.map(fact),
    clausesOf(pool),
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
      'en',
      topics,
      clausesOf([HTL_SITE]),
      AbortSignal.timeout(TEST_SIGNAL_MS),
    );
    expect(selected.map(({ id }) => id)).toEqual([
      HTL_SITE,
      ...topics.map(({ id }) => id),
    ]);
  });

  describe('with several uncovered clauses', () => {
    const FIRST = { query: 'first clause', pool: [HTL_SITE] };
    const SECOND = { query: 'second clause', pool: [SUPERVISOR, 'cv-matura'] };
    const THIRD = { query: 'third clause', pool: ['cv-matura'] };
    const byQuery =
      (answers: Record<string, string[]>): RankFacts =>
      async (query) => ({ corpusVersion, ids: answers[query] ?? [] });
    const run = (
      rank: RankFacts,
      candidates: readonly string[],
      clauses: Parameters<typeof withRescue>[3],
      budgetMs?: number,
    ) =>
      withRescue(
        rank,
        'en',
        candidates.map(fact),
        clauses,
        AbortSignal.timeout(TEST_SIGNAL_MS),
        budgetMs,
      ).then((selected) => selected.map(({ id }) => id));

    it('ranks each clause by its own text and keeps one fact per clause', async () => {
      const rank = vi.fn(
        byQuery({
          [FIRST.query]: [HTL_SITE],
          [SECOND.query]: [SUPERVISOR, 'cv-matura'],
        }),
      );
      expect(await run(rank, ['spotify-recovery'], [FIRST, SECOND])).toEqual([
        'spotify-recovery',
        HTL_SITE,
        SUPERVISOR,
      ]);
      expect(rank.mock.calls.map(([query]) => query)).toEqual([
        FIRST.query,
        SECOND.query,
      ]);
      expect(rank.mock.calls.map(([, , allowed]) => allowed)).toEqual([
        FIRST.pool,
        SECOND.pool,
      ]);
    });

    it('does not repeat a fact two clauses both rank first', async () => {
      const rank = byQuery({
        [FIRST.query]: [HTL_SITE],
        [SECOND.query]: [HTL_SITE, SUPERVISOR],
      });
      const clauses = [FIRST, { ...SECOND, pool: [HTL_SITE, SUPERVISOR] }];
      expect(await run(rank, ['spotify-recovery'], clauses)).toEqual([
        'spotify-recovery',
        HTL_SITE,
        SUPERVISOR,
      ]);
    });

    it('skips a fact the candidates already hold', async () => {
      const rank = byQuery({ [FIRST.query]: [HTL_SITE, 'cv-matura'] });
      const clause = { ...FIRST, pool: [HTL_SITE, 'cv-matura'] };
      expect(await run(rank, [HTL_SITE], [clause])).toEqual([
        HTL_SITE,
        'cv-matura',
      ]);
    });

    it(`adds at most ${RESCUED_FACTS} facts over all clauses`, async () => {
      const rank = byQuery({
        [FIRST.query]: [HTL_SITE],
        [SECOND.query]: [SUPERVISOR],
        [THIRD.query]: ['cv-matura'],
      });
      expect(
        await run(rank, ['spotify-recovery'], [FIRST, SECOND, THIRD]),
      ).toEqual(['spotify-recovery', HTL_SITE, SUPERVISOR]);
    });

    it('still adds the other clause when one ranker call finds nothing', async () => {
      const rank = byQuery({ [SECOND.query]: [SUPERVISOR] });
      expect(await run(rank, ['spotify-recovery'], [FIRST, SECOND])).toEqual([
        'spotify-recovery',
        SUPERVISOR,
      ]);
    });

    it('ranks the clauses in parallel within one budget', async () => {
      const stalled: RankFacts = (_q, _l, _a, signal) =>
        new Promise((_, reject) =>
          signal.addEventListener('abort', () => reject(signal.reason)),
        );
      const started = performance.now();
      expect(
        await run(stalled, ['cv-matura'], [FIRST, SECOND], SHORT_BUDGET_MS),
      ).toEqual(['cv-matura']);
      expect(performance.now() - started).toBeLessThan(TEST_SIGNAL_MS);
    });

    it('keeps the candidate list within the selector limit', async () => {
      const many = facts
        .filter(({ id }) => id.startsWith('spotify-'))
        .slice(0, MAX_CANDIDATES)
        .map(({ id }) => id);
      const rank = byQuery({
        [FIRST.query]: [HTL_SITE],
        [SECOND.query]: [SUPERVISOR],
      });
      const selected = await run(rank, many, [FIRST, SECOND]);
      expect(selected).toHaveLength(MAX_CANDIDATES);
      expect(selected.slice(-2)).toEqual([HTL_SITE, SUPERVISOR]);
    });
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

  it.each([
    [TUTTO_COMPOUND, TUTTO_MODES, TUTTO_STACK],
    [HEARTHCOIL_COMPOUND, HEARTHCOIL_PLAYTEST, HEARTHCOIL_LAUNCHER],
  ])(
    'gives the selector both facts of the compound %j',
    async (question, covered, expected) => {
      const rank: RankFacts = async (_q, _l, allowed) => ({
        corpusVersion,
        ids: allowed.includes(expected) ? [expected] : [],
      });
      const evidence = await evidenceFor(question, rank);
      expect(evidence).toContain(covered);
      expect(evidence).toContain(expected);
    },
  );

  it('does not call the ranker when every clause is covered', async () => {
    const rank = vi.fn(rankWith([HTL_SITE]));
    await evidenceFor(BOTH_COVERED, rank);
    expect(rank).not.toHaveBeenCalled();
  });

  it('keeps the strict candidates without a ranker', async () => {
    const evidence = await evidenceFor(HTL_CHAT);
    expect(evidence).not.toContain(HTL_SITE);
    expect(evidence.length).toBeGreaterThan(0);
  });
});
