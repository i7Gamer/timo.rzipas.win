import { describe, expect, it } from 'vitest';
import { prepareQuestion } from '../../../services/ask/selection.ts';
import type { Locale } from '../../i18n';
import { normalize } from './catalog';
import { unrecordedDetail } from './recorded-details';
import { approvedAnswer, reviewedCompoundClauses } from './reviewed-questions';

const PORTFOLIO = 'portfolio-website-architecture';
const ids = (question: string, locale: Locale) =>
  prepareQuestion(question, locale).fallback.claims.map(({ id }) => id);

describe('unrecordedDetail', () => {
  it.each([
    ['which nginx version does this portfolio use', [PORTFOLIO]],
    ['what was the title of chapter two', ['bachelor-title']],
    ['which gpu ran the benchmark', ['spotify-compare-performance']],
    ['welche cpu nutzte der benchmark', ['spotify-compare-performance']],
  ])('flags %j when the facts do not state it', (terms, factIds) => {
    expect(unrecordedDetail(terms, factIds)).toBe(true);
  });

  it.each([
    ['in which version was his import credited', ['spotify-upstream-review']],
    ['which chapters did he write', ['carini-team']],
  ])('accepts %j when a fact states it', (terms, factIds) => {
    expect(unrecordedDetail(terms, factIds)).toBe(false);
  });

  it.each([
    'does this portfolio have a german version',
    'how is this portfolio hosted',
  ])('ignores %j, which asks for no such detail', (terms) => {
    expect(unrecordedDetail(terms, [PORTFOLIO])).toBe(false);
  });

  it('treats no facts as recording nothing', () => {
    expect(unrecordedDetail('which nginx version', [])).toBe(true);
    expect(unrecordedDetail('how is it hosted', [])).toBe(false);
  });

  it('ignores ids missing from the catalogue', () => {
    expect(unrecordedDetail('which nginx version', ['no-such-fact'])).toBe(
      true,
    );
  });
});

describe('instant answers for details the catalogue lacks', () => {
  it.each([
    ['Which nginx version does this portfolio use?', 'en'],
    ['Welche nginx-Version nutzt dieses Portfolio?', 'de'],
    ['What was the title of chapter two in Timo’s bachelor thesis?', 'en'],
    ['Wie lautete der Titel von Kapitel zwei der Bachelorarbeit?', 'de'],
    ['Which GPU was used to benchmark SpotifyTracker’s Compare page?', 'en'],
    [
      'Welche GPU wurde für den Benchmark der SpotifyTracker-Vergleichsansicht verwendet?',
      'de',
    ],
  ] as const)('abstains on %j without the model', (question, locale) => {
    const prepared = prepareQuestion(question, locale);
    expect(prepared.fallback.status).toBe('unknown');
    expect(prepared.candidates).toEqual([]);
    expect(prepared.semanticPool).toEqual([]);
  });

  it.each([
    ['What is the title of Timo’s bachelor thesis?', 'en', 'bachelor-title'],
    ['Wie lautet der Titel der Bachelorarbeit?', 'de', 'bachelor-title'],
    ['How is this portfolio hosted?', 'en', PORTFOLIO],
    ['Wie wird dieses Portfolio gehostet?', 'de', PORTFOLIO],
    [
      'How much faster did the SpotifyTracker compare page get?',
      'en',
      'spotify-compare-performance',
    ],
    [
      'In which release did the upstream SpotifyTracker credit his import improvement?',
      'en',
      'spotify-upstream-review',
    ],
    [
      'In welcher Version wurde sein Import-Beitrag im ursprünglichen SpotifyTracker verbessert?',
      'de',
      'spotify-upstream-review',
    ],
  ] as const)('still answers %j', (question, locale, id) => {
    expect(prepareQuestion(question, locale).fallback.status).toBe('answer');
    expect(ids(question, locale)).toEqual([id]);
  });

  it.each([
    [
      'How is this portfolio hosted, and which nginx version does this portfolio use?',
      'en',
    ],
    [
      'Wie wird dieses Portfolio gehostet, und welche nginx-Version nutzt dieses Portfolio?',
      'de',
    ],
  ] as const)(
    'answers the supported part of %j as partial',
    (question, locale) => {
      const { fallback } = prepareQuestion(question, locale);
      expect(fallback.status).toBe('partial');
      expect(fallback.missing).toBe('additional-question');
      expect(fallback.claims.map(({ id }) => id)).toEqual([PORTFOLIO]);
    },
  );

  it('keeps the browser’s reviewed route from answering a missing detail', () => {
    expect(
      approvedAnswer(normalize('Which nginx version does this portfolio use?')),
    ).toBeUndefined();
  });

  it('marks a compound clause asking a missing detail as missing', () => {
    const clauses = [
      'How is this portfolio hosted',
      'which nginx version does this portfolio use',
    ];
    const [hosting, version] = reviewedCompoundClauses(
      clauses,
      normalize(clauses.join(', ')),
    );
    expect(hosting.reviewed.ids).toEqual([PORTFOLIO]);
    expect(version.reviewed).toEqual({
      ids: [],
      missing: 'additional-question',
    });
  });
});
