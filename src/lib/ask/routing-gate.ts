import assert from 'node:assert/strict';
import { CURRENT_WORK } from '../../data/current-work.ts';
import { facts, type Fact } from './catalog.ts';

export type RoutingExpectation = {
  locale: string;
  question: string;
  status: string;
  acceptableIds: string[][];
};

const EXPECTED_UNKNOWN_COUNT = 4;
const LANGUAGES = ['en', 'de'] as const;

export function assertRoutingExpectations(
  fixtures: readonly RoutingExpectation[],
  catalogue: readonly Fact[] = facts,
) {
  assert.equal(
    fixtures.filter(({ status }) => status === 'unknown').length,
    EXPECTED_UNKNOWN_COUNT,
    'routing expectation version changed: review the deliberate unknown count',
  );
  const dated = catalogue.find(({ id }) => id === 'current-work');
  const enrichment = catalogue.find(({ id }) => id === 'spotify-enrichment');
  for (const locale of LANGUAGES) {
    const local = fixtures.filter((fixture) => fixture.locale === locale);
    const activity = local.find(({ question }) =>
      /working on now|arbeitet Timo gerade/i.test(question),
    );
    assert.ok(
      activity?.status === 'answer' &&
        activity.acceptableIds.some(
          (ids) => ids.length === 1 && ids[0] === 'current-work',
        ),
      'dated activity must use the reviewed current-work snapshot',
    );
    const date = new Intl.DateTimeFormat(locale === 'de' ? 'de-CH' : 'en-GB', {
      dateStyle: 'long',
      timeZone: 'UTC',
    }).format(new Date(CURRENT_WORK.date));
    assert.ok(
      dated?.answer[locale].startsWith(
        (locale === 'de' ? 'Stand ' : 'As of ') + date,
      ),
      'the current-work snapshot answer must state its reviewed date',
    );
    const genre = local.find(({ question }) =>
      /how many genres|wie viele genres/i.test(question),
    );
    assert.ok(
      genre?.status === 'partial' &&
        genre.acceptableIds.some(
          (ids) => ids.length === 1 && ids[0] === 'spotify-enrichment',
        ),
      'Last.fm enrichment is reviewed but the genre count is unknown',
    );
    assert.ok(
      (locale === 'de' ? /keine feste Anzahl/ : /no fixed genre count/).test(
        enrichment?.answer[locale] ?? '',
      ),
      'Last.fm evidence must disclose that the genre count is unknown',
    );
  }
}
