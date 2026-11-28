import { describe, expect, it } from 'vitest';
import { extractPage } from '../../../scripts/ask-content';
import { prepareQuestion } from '../../../services/ask/selection.ts';
import type { Locale } from '../../i18n';
import { normalize } from './catalog';
import { supportsRequest } from './requested-attribute';
import { approvedAnswer, reviewedCompoundClauses } from './reviewed-questions';
import { findSiteContent, parseSiteContent } from './site-content';

const COMPARE = 'spotify-compare-performance';
const WEBSITE = 'portfolio-website-architecture';
const THESIS_TITLE = 'bachelor-title';

/** Whether the gateway answers fully from a reviewed route, with no model. */
function instantAnswer(question: string, locale: Locale) {
  const { fallback, candidates } = prepareQuestion(question, locale);
  return fallback.status === 'answer' && candidates.length === 0;
}

// Each names a reviewed route's subject but asks for an attribute its fact
// does not record.
const unsupported = [
  [
    'What statistical test was used for the SpotifyTracker Compare view benchmark?',
    'en',
  ],
  [
    'Welcher statistische Test wurde für den Benchmark der SpotifyTracker-Vergleichsansicht verwendet?',
    'de',
  ],
  ['How much does hosting this website cost?', 'en'],
  ['Was kostet es, diese Website zu hosten?', 'de'],
  ['What is the title of the introduction of Timo’s bachelor thesis?', 'en'],
  ['What was the title of the appendix in Timo’s bachelor thesis?', 'en'],
  ['Wie lautet der Titel der Einleitung von Timos Bachelorarbeit?', 'de'],
  ['Wie lautete der Titel des Anhangs der Bachelorarbeit?', 'de'],
] as const;

const supported = [
  [
    'How much faster is SpotifyTracker’s Compare view when sorting?',
    'en',
    COMPARE,
  ],
  [
    'Wie viel schneller ist die SpotifyTracker-Vergleichsansicht beim Sortieren?',
    'de',
    COMPARE,
  ],
  ['How is this website hosted?', 'en', WEBSITE],
  ['Wie wird diese Website gehostet?', 'de', WEBSITE],
  ['What was the title of Timo’s bachelor thesis?', 'en', THESIS_TITLE],
  ['Wie lautete der Titel von Timos Bachelorarbeit?', 'de', THESIS_TITLE],
] as const;

describe('instant answers need support for the requested attribute', () => {
  it.each(unsupported)(
    'leaves %j to inference instead of a reviewed route',
    (question, locale) => {
      expect(approvedAnswer(normalize(question), question)).toBeUndefined();
      expect(instantAnswer(question, locale)).toBe(false);
    },
  );

  it.each(supported)(
    'keeps the reviewed route for %j',
    (question, locale, id) => {
      expect(approvedAnswer(normalize(question), question)?.ids).toEqual([id]);
      expect(instantAnswer(question, locale)).toBe(true);
    },
  );
});

/** A compiled public index, as the browser loads it during an outage. */
const outageIndex = (locale: Locale) =>
  parseSiteContent(
    {
      locale,
      pages: [
        extractPage(
          '<main><h1>This Website</h1><p>Astro, hosted at home.</p></main>',
          '/projects/this-website/',
        ),
        extractPage(
          '<main><h1>SpotifyTracker</h1><p>Compare view benchmark.</p></main>',
          '/projects/spotify-stats-tracker/',
        ),
      ],
    },
    locale,
  )!;

describe('outage fallback', () => {
  it.each(unsupported)('gives no full answer to %j', (question, locale) => {
    for (const kind of ['overview', 'related'] as const)
      expect(
        findSiteContent(question, outageIndex(locale), kind)?.status,
      ).not.toBe('answer');
  });

  it.each(supported)('still answers %j', (question, locale) => {
    expect(
      findSiteContent(question, outageIndex(locale), 'overview')?.status,
    ).toBe('answer');
  });
});

describe('compound questions', () => {
  it.each([
    'How is this website hosted, and how much does hosting this website cost?',
    'Wie wird diese Website gehostet, und was kostet es, diese Website zu hosten?',
  ])('marks the unsupported part of %j missing', (question) => {
    const [hosting, cost] = reviewedCompoundClauses(
      [
        question.split(/, (?:and|und) /)[0],
        question.split(/, (?:and|und) /)[1],
      ],
      normalize(question),
    );
    expect(hosting.reviewed.ids).toEqual([WEBSITE]);
    expect(cost.reviewed).toEqual({ ids: [], missing: 'additional-question' });
  });
});

describe('supportsRequest', () => {
  it('needs a stated number for an amount', () => {
    expect(supportsRequest('how much faster is it', [COMPARE])).toBe(true);
    expect(supportsRequest('how much does it cost', [WEBSITE])).toBe(false);
  });

  it('accepts a question that names no requested noun', () => {
    expect(supportsRequest('how is this website hosted', [WEBSITE])).toBe(true);
  });

  it('skips articles and qualifiers before the noun', () => {
    expect(
      supportsRequest('what is the exact official title', [THESIS_TITLE]),
    ).toBe(true);
    expect(
      supportsRequest('wie lautete der genaue titel', [THESIS_TITLE]),
    ).toBe(true);
  });

  it('follows the noun the requested noun belongs to', () => {
    expect(
      supportsRequest('what is the title of the appendix', [THESIS_TITLE]),
    ).toBe(false);
    expect(
      supportsRequest('wie lautet der titel des anhangs', [THESIS_TITLE]),
    ).toBe(false);
  });

  it('ends the phrase at a verb, pronoun or name', () => {
    expect(supportsRequest('what title did timo choose', [THESIS_TITLE])).toBe(
      true,
    );
  });

  it('reads at most two nouns per phrase', () => {
    // "appendix" is a third noun, so it is not part of the request.
    expect(supportsRequest('what benchmark faster appendix', [COMPARE])).toBe(
      true,
    );
  });

  it('accepts the nouns a route answers itself', () => {
    expect(supportsRequest('which language', [THESIS_TITLE])).toBe(false);
    expect(
      supportsRequest('which language', [THESIS_TITLE], ['language']),
    ).toBe(true);
  });

  it('accepts plural forms of recorded words', () => {
    expect(supportsRequest('what titles', [THESIS_TITLE])).toBe(true);
  });
});
