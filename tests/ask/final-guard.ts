// Guards the final held-out question set against hand-written rules that
// answer its questions without the model. Freeze the current deterministic
// answers once, when a new final set is imported:
//
//   node tests/ask/final-guard.ts --freeze
import { readFileSync, writeFileSync } from 'node:fs';
import type { Locale } from '../../src/i18n';
import { prepareQuestion } from '../../services/ask/selection.ts';
import {
  historyTurns,
  parseQuestionSet,
  type HistoryEntry,
} from './question-set.ts';

export const FINAL_QUESTIONS = new URL(
  './final-questions.json',
  import.meta.url,
);
export const DETERMINISTIC_SNAPSHOT = new URL(
  './final-deterministic.json',
  import.meta.url,
);

/** Ids of questions that get reviewed claims before any model call. */
export function deterministicIds(
  fixtures: readonly {
    id: string;
    locale: Locale;
    question: string;
    history?: readonly HistoryEntry[];
  }[],
) {
  return fixtures
    .filter(
      ({ question, locale, history }) =>
        prepareQuestion(question, locale, historyTurns(history, locale))
          .fallback.claims.length > 0,
    )
    .map(({ id }) => id);
}

/** Deterministic ids that were not deterministic when the set was frozen. */
export function newlyDeterministic(
  current: readonly string[],
  frozen: readonly string[],
) {
  const known = new Set(frozen);
  return current.filter((id) => !known.has(id));
}

if (import.meta.main && process.argv.includes('--freeze')) {
  const ids = deterministicIds(
    parseQuestionSet(
      JSON.parse(readFileSync(FINAL_QUESTIONS, 'utf8')),
      'final-questions',
    ),
  );
  writeFileSync(DETERMINISTIC_SNAPSHOT, JSON.stringify(ids, null, 2) + '\n');
  console.log(`froze ${ids.length} deterministic final questions`);
}
