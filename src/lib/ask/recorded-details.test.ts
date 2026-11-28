import { describe, expect, it } from 'vitest';
import { prepareQuestion } from '../../../services/ask/selection.ts';
import type { Locale } from '../../i18n';
import { normalize } from './catalog';
import { statesAskedDetail, unrecordedDetail } from './recorded-details';
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

  it.each([
    ['which linux distribution hosts this portfolio website', [PORTFOLIO]],
    ['auf welcher linux distribution ist diese website gehostet', [PORTFOLIO]],
    [
      'which browser was used for the spotifytracker compare page benchmark',
      ['spotify-compare-performance'],
    ],
    [
      'welcher browser lief beim spotifytracker benchmark',
      ['spotify-compare-performance'],
    ],
    [
      'what is the title of the evaluation section of his bachelor thesis',
      ['bachelor-title'],
    ],
    [
      'wie lautet der titel des evaluationskapitels der bachelorarbeit',
      ['bachelor-title'],
    ],
    ['where was the benchmark run', ['spotify-compare-performance']],
    ['when did he take responsibility for jenkins', ['abacus-jenkins']],
    ['wann uebernahm er jenkins', ['abacus-jenkins']],
  ])('flags the unstated attribute in %j', (terms, factIds) => {
    expect(unrecordedDetail(terms, factIds)).toBe(true);
  });

  it.each([
    ['which ci server did he use at abacus', ['abacus-jenkins']],
    ['welches ci system betreute er', ['abacus-jenkins']],
    ['which data could his abacus workflow fill in', ['abacus-missing-data']],
    ['welche programmiersprache nutzt dieses portfolio', [PORTFOLIO]],
    ['which framework does this portfolio use', [PORTFOLIO]],
    ['and which institution was that at', ['tutoring']],
    ['an welcher hochschule war das', ['tutoring']],
    ['where did he tutor beginners', ['tutoring']],
    ['when was that', ['tutoring']],
    ['wo und wann war das', ['tutoring']],
    ['how long did he tutor', ['tutoring']],
    ['when did he build the class website', ['htl-dornbirn-class-website']],
    ['which kind of projects did he build', [PORTFOLIO]],
    // Values answer "which" without naming the noun; only kinds decline.
    ['welche farbe hat rudi', ['about.cats.rudi']],
    ['which abacus office did he work in', ['abacus-jenkins']],
  ])('accepts the stated attribute in %j', (terms, factIds) => {
    expect(unrecordedDetail(terms, factIds)).toBe(false);
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

describe('statesAskedDetail', () => {
  it.each([
    ['when was that', ['tutoring']],
    ['where', ['tutoring']],
    ['wann war das', ['tutoring']],
    ['which ci server was he responsible for', ['abacus-jenkins']],
    ['in which version was his import credited', ['spotify-upstream-review']],
    ['which data could his workflow fill in', ['abacus-missing-data']],
    ['which coat colour does rudi have', ['about.cats.rudi']],
  ])('confirms %j is answered by the facts', (terms, factIds) => {
    expect(statesAskedDetail(terms, factIds)).toBe(true);
  });

  it.each([
    ['how is it hosted', [PORTFOLIO]],
    ['which nginx version', [PORTFOLIO]],
    ['where and which browser', ['tutoring']],
    ['when was that', []],
    ['which abacus office did he work in', ['abacus-jenkins']],
    ['which programming language did he teach', ['tutoring']],
    ['which web framework powered it', ['htl-dornbirn-class-website']],
  ])('does not confirm %j', (terms, factIds) => {
    expect(statesAskedDetail(terms, factIds)).toBe(false);
  });
});

describe('requested detail heads', () => {
  const CARINI = 'carini-document-view';
  it.each([
    'which programming language did the carini document view use in the browser',
    'in the browser which programming language did the carini document view use',
    'welche programmiersprache nutzte die carini dokumentenansicht im browser',
    'im browser welche programmiersprache nutzte die carini dokumentenansicht',
    'which languages did the carini document view offer in the browser',
    'which service runs on linux with a gpu cluster',
    'the chapter on methods',
    'it runs on an operating system of his choice',
    'what is the processor of the cat',
  ])('does not treat the incidental mention in %j as asking', (terms) => {
    expect(unrecordedDetail(terms, [CARINI])).toBe(false);
  });

  it.each([
    'which browser did the carini document view support',
    'welchen browser unterstuetzte die carini dokumentenansicht',
    'in which browser did the carini document view run',
    'in welchem browser lief die carini dokumentenansicht',
    'what browser did the carini document view support',
    'was fuer ein browser lief die carini dokumentenansicht',
    'what web browser did it support',
    'on which distro did it run',
    'what operating system did it use',
    'which os did it use',
    'what gpu did it use',
    'which graphics card did it use',
    'what was the title of the carini chapter on methods',
    'wie lautet die versionsnummer',
  ])('flags %j as asking for a detail the facts lack', (terms) => {
    expect(unrecordedDetail(terms, [CARINI])).toBe(true);
  });

  it('does not require the literal noun after "what"', () => {
    expect(
      statesAskedDetail('what languages did the carini document view use', [
        CARINI,
      ]),
    ).toBe(false);
  });

  it.each([
    ['Which programming language did the CARINI document view use?', 'en'],
    [
      'Which programming language did the CARINI document view use in the browser?',
      'en',
    ],
    [
      'In the browser, which programming language did the CARINI document view use?',
      'en',
    ],
    ['Welche Programmiersprache nutzte die CARINI Dokumentenansicht?', 'de'],
    [
      'Welche Programmiersprache nutzte die CARINI Dokumentenansicht im Browser?',
      'de',
    ],
    [
      'Im Browser: welche Programmiersprache nutzte die CARINI Dokumentenansicht?',
      'de',
    ],
  ] as const)('answers %j with the document view fact', (question, locale) => {
    expect(approvedAnswer(normalize(question), question)?.ids).toEqual([
      CARINI,
    ]);
    expect(prepareQuestion(question, locale).fallback.status).toBe('answer');
    expect(ids(question, locale)).toEqual([CARINI]);
  });

  it.each([
    ['Which browser did the CARINI document view support?', 'en'],
    ['Welchen Browser unterstützte die CARINI Dokumentenansicht?', 'de'],
  ] as const)('still declines %j', (question, locale) => {
    expect(approvedAnswer(normalize(question), question)).toBeUndefined();
    expect(prepareQuestion(question, locale).fallback.status).not.toBe(
      'answer',
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
    ['Which Linux distribution hosts this portfolio website?', 'en'],
    ['Auf welcher Linux-Distribution ist diese Website gehostet?', 'de'],
    [
      'Which browser was used for the SpotifyTracker compare page performance benchmark?',
      'en',
    ],
    [
      'Welcher Browser lief beim SpotifyTracker Vergleichsansicht Benchmark?',
      'de',
    ],
    [
      'What is the title of the evaluation section of his bachelor thesis?',
      'en',
    ],
    ['Wie lautet der Titel des Evaluationskapitels der Bachelorarbeit?', 'de'],
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

  it.each([
    'Which nginx version does this portfolio use?',
    'Which Linux distribution hosts this portfolio website?',
    'Auf welcher Linux-Distribution ist diese Website gehostet?',
    'Which browser was used for the SpotifyTracker compare page performance benchmark?',
    'Welcher Browser lief beim SpotifyTracker Vergleichsansicht Benchmark?',
    'What is the title of the evaluation section of his bachelor thesis?',
    'Wie lautet der Titel des Evaluationskapitels der Bachelorarbeit?',
  ])('keeps the browser’s reviewed route from answering %j', (question) => {
    expect(approvedAnswer(normalize(question), question)).toBeUndefined();
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
