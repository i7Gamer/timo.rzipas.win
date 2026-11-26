import { describe, expect, it, vi } from 'vitest';
import {
  askModel,
  poolCandidates,
  prepareQuestion,
  type SelectFacts,
} from '../../../services/ask/selection.ts';

const PUSH = 'coilwatch-push-notifications';
const questions = [
  ['What did the Coilwatch app builder block, and how did Timo fix it?', 'en'],
  [
    'Was hat der App-Baukasten von Coilwatch blockiert, und wie hat Timo das gelöst?',
    'de',
  ],
] as const;

describe('the Coilwatch blocked-and-fixed compound', () => {
  const offered = (question: string, locale: 'en' | 'de') => {
    const prepared = prepareQuestion(question, locale);
    return prepared.candidates.length
      ? prepared.candidates
      : poolCandidates(prepared.semanticPool);
  };

  it.each(questions)('offers the reviewed fact for %j', (question, locale) => {
    expect(offered(question, locale).map(({ id }) => id)).toContain(PUSH);
  });

  it.each(questions)(
    'keeps the selected fact as a complete answer to %j',
    async (question, locale) => {
      const prepared = prepareQuestion(question, locale);
      const select = vi.fn<SelectFacts>(async (_q, _l, candidates) => ({
        status: 'answer',
        slots: [candidates.findIndex(({ id }) => id === PUSH) + 1],
      }));
      const result = await askModel(
        select,
        question,
        locale,
        offered(question, locale),
        AbortSignal.timeout(1_000),
        [],
        prepared.compound,
      );
      expect(result?.status).toBe('answer');
      expect(result?.claims.map(({ id }) => id)).toEqual([PUSH]);
    },
  );

  it.each([
    ['How did Timo get Coilwatch push notifications working?', 'en'],
    ['Wie hat Timo Push-Nachrichten in Coilwatch zum Laufen gebracht?', 'de'],
  ] as const)(
    'still answers the single question %j directly',
    (question, locale) => {
      expect(
        prepareQuestion(question, locale).fallback.claims.map(({ id }) => id),
      ).toEqual([PUSH]);
    },
  );

  it('does not offer the fact for an unrelated blocked question', () => {
    expect(
      prepareQuestion(
        'What did Abacus block, and how did Timo fix it?',
        'en',
      ).candidates.map(({ id }) => id),
    ).not.toContain(PUSH);
  });
});
