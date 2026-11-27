import { describe, expect, it, vi } from 'vitest';
import { askModel, prepareQuestion } from '../../../services/ask/selection.ts';
import type { SelectFacts } from '../../../services/ask/selection.ts';

// The first clause has a reviewed answer; the second needs the model.
const QUESTION =
  'What does Timo do at Abacus, and how does SpotifyTracker recover missed plays?';

async function ask(select: SelectFacts) {
  const { candidates, compound } = prepareQuestion(QUESTION, 'en');
  expect(compound?.length).toBe(2);
  return askModel(
    select,
    QUESTION,
    'en',
    candidates,
    AbortSignal.timeout(1_000),
    undefined,
    compound,
  );
}

describe('compound questions with a reviewed clause', () => {
  it('keeps the reviewed clause when the model finds nothing for the rest', async () => {
    const result = await ask(
      vi.fn(async () => ({ slots: [], status: 'unknown' })),
    );
    expect(result?.status).toBe('partial');
    expect(result?.claims.map(({ id }) => id)).toEqual(['abacus-workflow']);
    expect(result?.missing).toBe('additional-question');
  });

  it('adds the model-selected fact for the other clause', async () => {
    const result = await ask(
      vi.fn(async () => ({ slots: [1], status: 'answer' })),
    );
    expect(result?.status).toBe('answer');
    expect(result?.claims.map(({ id }) => id)).toEqual([
      'abacus-workflow',
      'spotify-recovery',
    ]);
  });

  it('still rejects an invalid model decision', async () => {
    const result = await ask(
      vi.fn(async () => ({ slots: [9], status: 'answer' })),
    );
    expect(result).toBeNull();
  });
});
