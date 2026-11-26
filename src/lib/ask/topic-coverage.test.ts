import { describe, expect, it, vi } from 'vitest';
import {
  askModel,
  prepareQuestion,
  type SelectFacts,
} from '../../../services/ask/selection.ts';
import { CV_OVERVIEW_IDS, MAX_CLAIMS, facts, normalize } from './catalog';
import { topicMoreIds } from './reviewed-questions';
import {
  expandTopicMatches,
  topicCandidates,
  topicContinuation,
  topicFactIds,
  topicSelection,
} from './topics';

const HIRE_IDS = ['abacus-workflow', 'stadler-vpn', 'spotify-python'];
const LEISURE = 'portfolio-leisure';
const fact = (id: string) => facts.find((entry) => entry.id === id)!;

describe('several topics in one question', () => {
  it.each([
    'cv and hobbies',
    'hobbies and cv',
    'work experience and hobbies',
    'hobbies and work experience',
    'lebenslauf und freizeit',
    'freizeit und lebenslauf',
  ])('gives every topic in %j at least one fact', (question) => {
    const ids = topicFactIds(question)!;
    expect(ids).toContain(LEISURE);
    expect(ids.length).toBe(MAX_CLAIMS);
    expect(ids.some((id) => id !== LEISURE)).toBe(true);
  });

  it('takes facts from each topic in turn, in question order', () => {
    expect(topicFactIds('cv and hobbies')).toEqual([
      CV_OVERVIEW_IDS[0],
      LEISURE,
      CV_OVERVIEW_IDS[1],
    ]);
  });

  it('marks the answer partial when a topic gets no slot', () => {
    const selection = topicSelection('cv education hobbies location')!;
    expect(selection.ids.length).toBe(MAX_CLAIMS);
    expect(selection.partial).toBe(true);
  });

  it('is complete when every topic is covered', () => {
    expect(topicSelection('cv and hobbies')?.partial).toBeUndefined();
    expect(topicSelection('cv')?.partial).toBeUndefined();
  });

  it.each([
    ['cv and hobbies', 'en'],
    ['Lebenslauf und Freizeit', 'de'],
  ] as const)('answers %j directly with both topics', (question, locale) => {
    const prepared = prepareQuestion(question, locale);
    expect(prepared.fallback.status).toBe('answer');
    expect(prepared.fallback.claims.map(({ id }) => id)).toContain(LEISURE);
  });

  it('expands several selected topics fairly', () => {
    const [cv, hobbies] = ['topic:cv', 'topic:hobbies'].map((id) =>
      topicCandidates().find((candidate) => candidate.id === id)!,
    );
    const ids = expandTopicMatches([cv, hobbies]).map(({ id }) => id);
    expect(ids).toContain(LEISURE);
    expect(ids.length).toBe(MAX_CLAIMS);
  });

  it('keeps a directly selected fact next to a topic', () => {
    const hire = topicCandidates().find(({ id }) => id === 'topic:hire')!;
    const ids = expandTopicMatches([hire, fact(LEISURE)]).map(({ id }) => id);
    expect(ids).toContain(LEISURE);
    expect(ids).toContain(HIRE_IDS[0]);
  });
});

describe('a selected topic in a compound question', () => {
  it.each([
    ['Why hire Timo, and what is his salary?', 'en'],
    ['Warum Timo einstellen, und wie hoch ist sein Gehalt?', 'de'],
  ] as const)(
    'reports %j as partial when the other part is unanswered',
    async (question, locale) => {
      const select = vi.fn<SelectFacts>(async (_q, _l, candidates) => ({
        status: 'answer',
        slots: [candidates.findIndex(({ id }) => id === 'topic:hire') + 1],
      }));
      const result = await askModel(
        select,
        question,
        locale,
        topicCandidates(),
        AbortSignal.timeout(1_000),
      );
      expect(result?.status).toBe('partial');
      expect(result?.missing).toBe('additional-question');
      expect(result?.claims.map(({ id }) => id)).toEqual(HIRE_IDS);
    },
  );

  it('keeps a complete status when the topic answers the whole question', async () => {
    const select = vi.fn<SelectFacts>(async (_q, _l, candidates) => ({
      status: 'answer',
      slots: [candidates.findIndex(({ id }) => id === 'topic:hire') + 1],
    }));
    const result = await askModel(
      select,
      'what makes him stand out',
      'en',
      topicCandidates(),
      AbortSignal.timeout(1_000),
    );
    expect(result?.status).toBe('answer');
  });
});

describe('broad topics in compound questions', () => {
  it.each([
    ['Tell me about his CV, and what are his hobbies?', 'en'],
    ['Lebenslauf, und was macht er in seiner Freizeit?', 'de'],
    ['What are his hobbies, and tell me about his CV?', 'en'],
  ] as const)('represents every topic in %j', (question, locale) => {
    const prepared = prepareQuestion(question, locale);
    const ids = prepared.fallback.claims.map(({ id }) => id);
    expect(ids).toContain(LEISURE);
    expect(ids.some((id) => CV_OVERVIEW_IDS.includes(id as never))).toBe(true);
    expect(ids.length).toBeLessThanOrEqual(MAX_CLAIMS);
    expect(prepared.fallback.status).toBe('answer');
  });

  it('keeps a precise clause whole next to a broad topic', () => {
    const ids = prepareQuestion(
      'What does Timo do at Abacus, and what are his hobbies?',
      'en',
    ).fallback.claims.map(({ id }) => id);
    expect(ids).toContain('abacus-workflow');
    expect(ids).toContain(LEISURE);
  });

  it('still marks an unanswered clause as missing', () => {
    const prepared = prepareQuestion(
      'Tell me about his CV, and is he left-handed?',
      'en',
    );
    expect(prepared.fallback.status).toBe('partial');
    expect(prepared.fallback.missing).toBe('additional-question');
  });
});

describe('more after several topics', () => {
  const answerOf = (ids: readonly string[]) =>
    ids.map((id) => fact(id).answer.en).join(' ');

  it.each([
    ['CV and hobbies', 'additional details'],
    ['Lebenslauf und Freizeit', 'weitere details'],
  ])('continues the remaining topic after %j', (question, more) => {
    const first = topicFactIds(normalize(question))!;
    const next = topicMoreIds(more, [{ question, answer: answerOf(first) }])!;
    expect(next.length).toBeGreaterThan(0);
    for (const id of first) expect(next).not.toContain(id);
    expect(
      next.some(
        (id) =>
          CV_OVERVIEW_IDS.includes(id as never) ||
          id.startsWith('cv') ||
          id.startsWith('career'),
      ),
    ).toBe(true);
  });

  it('is exhausted only when every topic is', () => {
    const pools = ['cv', 'hobbies'].map((t) => topicContinuation(t)!);
    const shown = answerOf([...new Set(pools.flat())]);
    expect(
      topicMoreIds('more', [{ question: 'CV and hobbies', answer: shown }]),
    ).toEqual([]);
  });
});
