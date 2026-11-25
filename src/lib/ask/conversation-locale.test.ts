import { describe, expect, it } from 'vitest';
import { questionLocale } from './conversation';
import approved from '../../../tests/ask/approved-answers.json';
import heldOut from '../../../tests/ask/held-out.json';
import paraphrases from '../../../tests/ask/paraphrases.json';
import questions from '../../../tests/ask/questions.json';
import routing from '../../../tests/ask/routing.json';

describe('questionLocale', () => {
  it('routes all distinct reviewed fixtures by their labeled language', () => {
    const fixtures = [
      ...approved,
      ...heldOut,
      ...paraphrases,
      ...questions,
      ...routing,
    ];
    const distinct = new Map(
      fixtures.map((fixture) => [
        `${fixture.locale}\0${fixture.question}`,
        fixture,
      ]),
    );
    expect(distinct.size).toBe(165);
    const mismatches = [...distinct.values()].filter(
      (fixture) =>
        questionLocale(
          fixture.question,
          fixture.locale === 'de' ? 'en' : 'de',
        ) !== fixture.locale,
    );
    expect(
      mismatches.map(({ locale, question }) => `${locale}: ${question}`),
    ).toEqual([]);
  });
  it.each([
    ['Pitch about Timo', 'de', 'en'],
    ['Write me an introduction about Timo', 'de', 'en'],
    ['Stell Timo kurz vor', 'en', 'de'],
    ['Give me a good 200 word pitch about Timo', 'de', 'en'],
    ['Schreib mir einen Pitch über Timo in etwa 200 Wörtern', 'en', 'de'],
    ['This is not about 200 words', 'de', 'en'],
    ['Das sind keine 200 Wörter', 'en', 'de'],
    ['Was SpotifyTracker a rewrite?', 'en', 'en'],
    ['Was Hearthcoil built in Unity?', 'de', 'en'],
    ['Was SpotifyTracker?', 'en', 'en'],
    ['Was SpotifyTracker?', 'de', 'de'],
    ['Was the tracker rewritten?', 'en', 'en'],
    ['Was kostet SpotifyTracker?', 'en', 'de'],
    ['Was hat SpotifyTracker gebaut?', 'en', 'de'],
    ['Was macht SpotifyTracker?', 'en', 'de'],
    ['Was nutzt SpotifyTracker?', 'en', 'de'],
    ['Was ist SpotifyTracker?', 'en', 'de'],
    ['Was?', 'de', 'de'],
    ['Was?', 'en', 'en'],
    ['Open Source Beiträge', 'en', 'de'],
    ['Open Source Projekte', 'en', 'de'],
    ['Open Source projects', 'de', 'en'],
    ['Open Source', 'de', 'de'],
    ['Open Source', 'en', 'en'],
    ['Open the portfolio', 'de', 'en'],
  ] as const)('detects the locale of %j', (question, fallback, expected) => {
    expect(questionLocale(question, fallback)).toBe(expected);
  });
  it.each(['More', 'Okay'])(
    'keeps ambiguous short fragment %j on the fallback locale',
    (question) => {
      expect(questionLocale(question, 'de')).toBe('de');
    },
  );
  it('keeps a bare pitch on the conversation locale', () => {
    expect(questionLocale('Pitch', 'de')).toBe('de');
    expect(questionLocale('Pitch', 'en')).toBe('en');
  });
});
