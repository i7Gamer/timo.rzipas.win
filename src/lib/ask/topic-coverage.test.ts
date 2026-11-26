import { describe, expect, it, vi } from 'vitest';
import {
  askModel,
  prepareQuestion,
  type SelectFacts,
} from '../../../services/ask/selection.ts';
import { CV_OVERVIEW_IDS, MAX_CLAIMS, facts } from './catalog';
import {
  expandTopicMatches,
  topicCandidates,
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
