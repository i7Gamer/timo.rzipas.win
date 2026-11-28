import { describe, expect, it } from 'vitest';
import {
  isChatHistory,
  MAX_HISTORY_BYTES,
  recallChat,
  selectChatHistory,
} from './history';

const firstTurn = {
  question: 'What did Timo build?',
  answer: 'He used Flask for the SpotifyTracker rewrite.',
};
const shortTurns = [
  firstTurn,
  ...Array.from({ length: 6 }, (_, index) => ({
    question: `Question ${index + 1}?`,
    answer: `Answer ${index + 1}.`,
  })),
];

describe('chat history', () => {
  it('sends every question and answer if the transcript fits the budget', () => {
    expect(selectChatHistory(shortTurns, 'What else?')).toEqual(shortTurns);
    expect(isChatHistory(shortTurns)).toBe(true);
  });

  it('finds a match deep in an older answer and keeps both sides of recent turns', () => {
    const old = {
      ...firstTurn,
      answer: 'Notes on the project. '.repeat(100) + firstTurn.answer,
    };
    const longTurns = Array.from({ length: 10 }, (_, index) => ({
      question: `Question ${index + 1}?`,
      answer: 'Unrelated details. '.repeat(80),
    }));
    const history = selectChatHistory([old, ...longTurns], 'What used Flask?');
    expect(history[0]).toMatchObject({
      question: firstTurn.question,
      answer: expect.stringContaining(firstTurn.answer),
    });
    expect(history.at(-1)?.question).toBe(longTurns.at(-1)?.question);
    expect(isChatHistory(history)).toBe(true);
    expect(
      new TextEncoder().encode(JSON.stringify(history)).length,
    ).toBeLessThanOrEqual(MAX_HISTORY_BYTES);
    expect(isChatHistory([old])).toBe(false);
  });

  it('recalls earlier questions and replies across both languages', () => {
    expect(recallChat('What did I ask first?', shortTurns)).toMatchObject({
      field: 'question',
      turn: firstTurn,
    });
    expect(
      recallChat('What did you say about Flask earlier?', shortTurns),
    ).toMatchObject({
      field: 'answer',
      turn: firstTurn,
    });
    expect(
      recallChat('Was hast du über Flask gesagt?', shortTurns),
    ).toMatchObject({
      field: 'answer',
      turn: firstTurn,
    });
    expect(recallChat('What was your first answer?', [])).toEqual({
      field: 'answer',
      turn: undefined,
    });
    expect(recallChat('What is Flask?', shortTurns)).toBeNull();
  });

  it('can find an earlier project from a detail that was only in its reply', () => {
    const tutoring = {
      question: 'What did you build for Tutto?',
      answer: 'Tutto has an optional strategy coach called Ask Otto.',
    };
    expect(
      recallChat(
        'Which project did I ask about earlier, and what was its coach called?',
        [tutoring, ...shortTurns],
      ),
    ).toEqual({ field: 'answer', turn: tutoring });
  });

  it('can recall a topic from a supporting excerpt without repeating the excerpt as the answer', () => {
    const earlier = {
      question: 'What is SpotifyTracker?',
      answer: 'SpotifyTracker keeps listening statistics.',
      evidence: ['It uses SQLite to store listening history.'],
    };
    expect(
      recallChat('What did you say about SQLite earlier?', [earlier]),
    ).toEqual({
      field: 'answer',
      turn: earlier,
    });
  });
});
