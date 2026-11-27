import { describe, expect, it } from 'vitest';
import {
  historyTurns,
  parseQuestionSet,
} from '../../../tests/ask/question-set.ts';
import { facts, MAX_CLAIMS } from './catalog';

const entry = (overrides: Record<string, unknown> = {}) => ({
  id: 'dev-en-001',
  family: 'spotify-storage',
  category: 'same-project-overlap',
  locale: 'en',
  question: 'Which database does SpotifyTracker use?',
  status: 'answer',
  acceptableIds: [['spotify-accounts']],
  confidence: 'sure',
  notes: 'Only spotify-accounts names the storage.',
  ...overrides,
});

describe('question-set files', () => {
  it('turns entries into evaluator fixtures for the named suite', () => {
    const [fixture] = parseQuestionSet([entry()], 'dev');
    expect(fixture).toMatchObject({
      suite: 'dev',
      id: 'dev-en-001',
      family: 'spotify-storage',
      category: 'same-project-overlap',
      locale: 'en',
      question: 'Which database does SpotifyTracker use?',
      status: 'answer',
      acceptableIds: [['spotify-accounts']],
    });
    expect(fixture.history).toBeUndefined();
  });

  it('keeps follow-up history as question and answer ids', () => {
    const history = [
      { question: 'What is SpotifyTracker?', answerIds: ['spotify-rewrite'] },
    ];
    const [fixture] = parseQuestionSet(
      [entry({ question: 'And which database?', history })],
      'final',
    );
    expect(fixture.history).toEqual(history);
  });

  it.each([
    ['an unknown locale', { locale: 'fr' }, /locale/],
    ['an unknown status', { status: 'maybe' }, /status/],
    ['an empty question', { question: '  ' }, /question/],
    [
      'an unknown fact id',
      { acceptableIds: [['no-such-fact']] },
      /no-such-fact/,
    ],
    [
      'too many facts in one answer',
      { acceptableIds: [facts.slice(0, MAX_CLAIMS + 1).map(({ id }) => id)] },
      /at most/,
    ],
    ['facts for an unknown answer', { status: 'unknown' }, /unknown/],
    ['no facts for an answer', { acceptableIds: [[]] }, /needs facts/],
    ['no alternatives', { acceptableIds: [] }, /acceptableIds/],
    [
      'an unknown history fact',
      { history: [{ question: 'Hi?', answerIds: ['nope'] }] },
      /nope/,
    ],
    [
      'a history turn without question',
      { history: [{ answerIds: [] }] },
      /history/,
    ],
  ])('rejects %s', (_, overrides, message) => {
    expect(() => parseQuestionSet([entry(overrides)], 'dev')).toThrow(message);
  });

  it('accepts an unknown expectation with no facts', () => {
    const [fixture] = parseQuestionSet(
      [entry({ status: 'unknown', acceptableIds: [[]] })],
      'dev',
    );
    expect(fixture.acceptableIds).toEqual([[]]);
  });

  it('rejects duplicate ids and names the entry', () => {
    expect(() => parseQuestionSet([entry(), entry()], 'dev')).toThrow(
      /dev-en-001/,
    );
  });

  it.each([null, 'text', 3])('rejects the entry %j', (raw) => {
    expect(() => parseQuestionSet([raw], 'dev')).toThrow(/#1.*object/);
  });

  it('rejects history that is not a list', () => {
    expect(() =>
      parseQuestionSet([entry({ history: 'earlier' })], 'dev'),
    ).toThrow(/history must be a list/);
  });

  it('rejects a file that is not an array', () => {
    expect(() => parseQuestionSet({}, 'dev')).toThrow(/array/);
  });
});

describe('history turns', () => {
  it('renders each earlier answer from the reviewed fact text', () => {
    const [rewrite, python] = ['spotify-rewrite', 'spotify-python'].map((id) =>
      facts.find((fact) => fact.id === id)!,
    );
    expect(
      historyTurns(
        [
          {
            question: 'Was ist SpotifyTracker?',
            answerIds: ['spotify-rewrite', 'spotify-python'],
          },
        ],
        'de',
      ),
    ).toEqual([
      {
        question: 'Was ist SpotifyTracker?',
        answer: rewrite.answer.de + ' ' + python.answer.de,
      },
    ]);
  });

  it('returns no turns without history', () => {
    expect(historyTurns(undefined, 'en')).toEqual([]);
  });
});
