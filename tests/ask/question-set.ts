// Loads owner-reviewed question-set files (development and final held-out
// sets) into evaluator fixtures. Pure so the validation rules are unit-tested.
import { facts, MAX_CLAIMS } from '../../src/lib/ask/catalog.ts';
import type { ChatTurn } from '../../src/lib/ask/history.ts';
import type { Locale } from '../../src/i18n';

export interface HistoryEntry {
  question: string;
  answerIds: string[];
}

export interface QuestionSetFixture {
  suite: string;
  id: string;
  family?: string;
  category?: string;
  locale: Locale;
  question: string;
  status: 'answer' | 'partial' | 'unknown';
  acceptableIds: string[][];
  history?: HistoryEntry[];
}

const LOCALES = new Set(['en', 'de']);
const STATUSES = new Set(['answer', 'partial', 'unknown']);
const factIds = new Set(facts.map(({ id }) => id));

function checkIds(ids: unknown, where: string): string[] {
  if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string'))
    throw new Error(`${where}: fact ids must be strings`);
  const unknown = ids.filter((id) => !factIds.has(id));
  if (unknown.length)
    throw new Error(`${where}: unknown fact ids ${unknown.join(', ')}`);
  return ids;
}

function parseHistory(value: unknown, where: string) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value))
    throw new Error(`${where}: history must be a list`);
  return value.map((turn, index) => {
    const label = `${where} history ${index + 1}`;
    if (
      !turn ||
      typeof turn !== 'object' ||
      typeof turn.question !== 'string' ||
      !turn.question.trim()
    )
      throw new Error(`${label}: history turns need a question`);
    return {
      question: turn.question,
      answerIds: checkIds(turn.answerIds, label),
    };
  });
}

/** Validates a question-set file and returns fixtures for one suite. */
export function parseQuestionSet(
  data: unknown,
  suite: string,
): QuestionSetFixture[] {
  if (!Array.isArray(data))
    throw new Error(`${suite}: a question set must be an array`);
  const seen = new Set<string>();
  return data.map((raw, index) => {
    if (!raw || typeof raw !== 'object')
      throw new Error(`${suite} #${index + 1}: each entry must be an object`);
    const entry = raw as Record<string, unknown>;
    const where = `${suite} ${typeof entry?.id === 'string' ? entry.id : '#' + (index + 1)}`;
    if (typeof entry.id !== 'string' || seen.has(entry.id))
      throw new Error(`${where}: missing or duplicate id`);
    seen.add(entry.id);
    if (typeof entry.locale !== 'string' || !LOCALES.has(entry.locale))
      throw new Error(`${where}: locale must be en or de`);
    if (typeof entry.question !== 'string' || !entry.question.trim())
      throw new Error(`${where}: question must not be empty`);
    if (typeof entry.status !== 'string' || !STATUSES.has(entry.status))
      throw new Error(`${where}: status must be answer, partial or unknown`);
    if (!Array.isArray(entry.acceptableIds) || !entry.acceptableIds.length)
      throw new Error(`${where}: acceptableIds needs at least one alternative`);
    const acceptableIds = entry.acceptableIds.map((ids) => {
      const checked = checkIds(ids, where);
      if (checked.length > MAX_CLAIMS)
        throw new Error(`${where}: an answer has at most ${MAX_CLAIMS} facts`);
      if (entry.status === 'unknown' && checked.length)
        throw new Error(`${where}: an unknown answer takes no facts`);
      if (entry.status !== 'unknown' && !checked.length)
        throw new Error(`${where}: an ${entry.status} answer needs facts`);
      return checked;
    });
    const history = parseHistory(entry.history, where);
    return {
      suite,
      id: entry.id,
      ...(typeof entry.family === 'string' ? { family: entry.family } : {}),
      ...(typeof entry.category === 'string'
        ? { category: entry.category }
        : {}),
      locale: entry.locale as Locale,
      question: entry.question,
      status: entry.status as QuestionSetFixture['status'],
      acceptableIds,
      ...(history ? { history } : {}),
    };
  });
}

/** Earlier turns as the browser sends them: each answer is its fact text. */
export function historyTurns(
  history: readonly HistoryEntry[] | undefined,
  locale: Locale,
): ChatTurn[] {
  return (history ?? []).map(({ question, answerIds }) => ({
    question,
    answer: answerIds
      .map((id) => facts.find((fact) => fact.id === id)!.answer[locale])
      .join(' '),
  }));
}
