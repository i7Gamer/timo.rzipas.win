import { describe, expect, it } from 'vitest';
import { prepareQuestion } from '../../../services/ask/selection.ts';
import { facts } from './catalog';
import {
  lastSubstantiveTurn,
  refersBack,
  subjectChange,
  type ChatTurn,
} from './history';
import { normalize } from './catalog';

describe('follow-up wording', () => {
  it.each([
    'And which institution was that at?',
    'What about the database?',
    'Did he use Docker there?',
    'Was it open source?',
    'Und an welcher Hochschule war das?',
    'Wie lange war er dort?',
    'Wurde es veröffentlicht?',
  ])('treats %j as referring back', (question) => {
    expect(refersBack(normalize(question))).toBe(true);
  });

  it.each([
    'Why does Timo host his own services?',
    'Is there a project with Flask?',
    'Gibt es ein Projekt mit Flask?',
    'Was kann das Spiel?',
  ])('treats %j as independent', (question) => {
    expect(refersBack(normalize(question))).toBe(false);
  });

  it.each([
    'New topic: what is it?',
    'A different question: was it hard?',
    'Something else: where is it?',
    'Anderes Thema: was ist das?',
    'Neue Frage: wo war das?',
  ])('recognizes the subject change in %j', (question) => {
    expect(subjectChange.test(normalize(question))).toBe(true);
  });

  it('finds the last turn that is not a social acknowledgement', () => {
    const turns = [
      { question: 'Who did he tutor?', answer: 'Students.' },
      { question: 'Thanks!', answer: 'You’re welcome!' },
      { question: 'ok', answer: 'Alright.' },
    ];
    expect(lastSubstantiveTurn(turns)).toBe(turns[0]);
    expect(lastSubstantiveTurn(turns.slice(1))).toBeUndefined();
    expect(lastSubstantiveTurn([])).toBeUndefined();
  });
});

const turn = (question: string, id: string): ChatTurn => ({
  question,
  answer: facts.find((fact) => fact.id === id)!.answer.en,
});
const tutoring = turn('Did Timo tutor programming beginners?', 'tutoring');
const tutto = turn('How does Tutto sync its rooms?', 'tutto-stack');

describe('follow-up retrieval', () => {
  it('ranks within the previous turn’s topic when the question names none', () => {
    const prepared = prepareQuestion(
      'And which institution was that at?',
      'en',
      [tutoring],
    );
    expect(prepared.candidates).toEqual([]);
    expect(prepared.semanticPool).toContain('tutoring');
    expect(prepared.semanticPool).not.toContain('tutto-stack');
  });

  it('uses only the most recent turn', () => {
    const prepared = prepareQuestion(
      'And which institution was that at?',
      'en',
      [tutto, tutoring],
    );
    expect(prepared.semanticPool).toContain('tutoring');
    expect(prepared.semanticPool).not.toContain('tutto-stack');
  });

  it('keeps a broad search without history', () => {
    const prepared = prepareQuestion(
      'And which institution was that at?',
      'en',
    );
    expect(prepared.semanticPool).toEqual([]);
  });

  it('keeps a broad search when the previous turn names no topic', () => {
    const prepared = prepareQuestion(
      'And which institution was that at?',
      'en',
      [{ question: 'Hello?', answer: 'Hi, what would you like to know?' }],
    );
    expect(prepared.semanticPool).toEqual([]);
  });

  it.each([
    ['Thanks', 'You’re welcome!'],
    ['Danke', 'Gern geschehen!'],
    ['ok', 'Alright.'],
  ])('skips a social turn (%s) to find the topic', (question, answer) => {
    const prepared = prepareQuestion(
      'And which institution was that at?',
      'en',
      [tutoring, { question, answer }],
    );
    expect(prepared.semanticPool).toContain('tutoring');
  });

  it('keeps the topic when the follow-up switches language', () => {
    const prepared = prepareQuestion(
      'Und an welcher Hochschule war das?',
      'de',
      [tutoring],
    );
    expect(prepared.semanticPool).toContain('tutoring');
  });

  it.each([
    ['Why does Timo host his own services?', 'en'],
    ['Warum betreibt Timo seine Dienste selbst?', 'de'],
  ] as const)(
    'keeps the broad search for an independent question: %s',
    (question, locale) => {
      const fresh = prepareQuestion(question, locale);
      const after = prepareQuestion(question, locale, [tutoring]);
      expect(after.semanticPool).toEqual([]);
      expect(after.candidates).toEqual(fresh.candidates);
    },
  );

  it.each([
    ['New topic: what is it written in?', 'en'],
    ['Anderes Thema: worin ist es geschrieben?', 'de'],
  ] as const)(
    'drops the previous topic after a subject change: %s',
    (question, locale) => {
      expect(
        prepareQuestion(question, locale, [tutoring]).semanticPool,
      ).toEqual([]);
    },
  );

  it('lets a question with its own topic ignore the history', () => {
    const question = 'How does Tutto sync its rooms?';
    const withHistory = prepareQuestion(question, 'en', [tutoring]);
    const alone = prepareQuestion(question, 'en');
    expect(withHistory.candidates.map(({ id }) => id)).toEqual(
      alone.candidates.map(({ id }) => id),
    );
    expect(withHistory.semanticPool).toEqual(alone.semanticPool);
  });
});
