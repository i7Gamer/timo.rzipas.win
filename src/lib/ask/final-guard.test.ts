import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DETERMINISTIC_SNAPSHOT,
  FINAL_QUESTIONS,
  deterministicIds,
  newlyDeterministic,
} from '../../../tests/ask/final-guard.ts';
import { parseQuestionSet } from '../../../tests/ask/question-set.ts';

describe('deterministic answers', () => {
  it('lists questions answered without the model', () => {
    expect(
      deterministicIds([
        // A reviewed whole-question route answers this one directly.
        {
          id: 'reviewed',
          locale: 'en',
          question: 'What is Timo working on now?',
        },
        // This one needs the selector.
        {
          id: 'model',
          locale: 'en',
          question: 'How does SpotifyTracker recover missed plays?',
        },
        { id: 'unknown', locale: 'en', question: 'Who won the World Cup?' },
      ]),
    ).toEqual(['reviewed']);
  });

  it('reports only ids missing from the frozen snapshot', () => {
    expect(newlyDeterministic(['a', 'b', 'c'], ['a', 'c'])).toEqual(['b']);
    expect(newlyDeterministic(['a'], ['a', 'gone'])).toEqual([]);
  });
});

// The final held-out set is frozen with its deterministic answers when it is
// imported. A later rule that answers another final question without the
// model would leak that question into the code, so it must fail here.
describe.skipIf(!existsSync(FINAL_QUESTIONS))('final held-out set', () => {
  it('gains no hand-written answers after it was frozen', () => {
    const fixtures = parseQuestionSet(
      JSON.parse(readFileSync(FINAL_QUESTIONS, 'utf8')),
      'final-questions',
    );
    const frozen: string[] = JSON.parse(
      readFileSync(DETERMINISTIC_SNAPSHOT, 'utf8'),
    );
    expect(newlyDeterministic(deterministicIds(fixtures), frozen)).toEqual([]);
  });
});
