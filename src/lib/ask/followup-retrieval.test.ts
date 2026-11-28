import { describe, expect, it } from 'vitest';
import { prepareQuestion } from '../../../services/ask/selection.ts';
import { facts } from './catalog';
import type { ChatTurn } from './history';

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
