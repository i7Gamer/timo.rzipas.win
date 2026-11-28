import { describe, expect, it } from 'vitest';
import { prepareQuestion } from '../../../services/ask/selection.ts';
import type { Locale } from '../../i18n';

/** Facts a question can reach: its shortlist and its ranking pool. */
function reachable(question: string, locale: Locale = 'en') {
  const { candidates, semanticPool, fallback } = prepareQuestion(
    question,
    locale,
  );
  return [
    ...candidates.map(({ id }) => id),
    ...semanticPool,
    ...fallback.claims.map(({ id }) => id),
  ];
}

describe('project names reach every source of the project', () => {
  it.each([
    [
      'Did the SpotifyTracker Compare benchmark change the database?',
      'en',
      'spotify-compare-performance',
    ],
    [
      'Which SpotifyTracker release mentioned his import change?',
      'en',
      'spotify-upstream-review',
    ],
    [
      'Wurde der Tutto-Server für die Kompatibilität angepasst?',
      'de',
      'tutto-online-compatibility',
    ],
    [
      'What did Timo do in his first Stadler summer jobs?',
      'en',
      'early-stadler',
    ],
    ['Hat die Bachelorarbeit einen offiziellen Titel?', 'de', 'bachelor-title'],
    ['Why does Timo run his own homelab?', 'en', 'homelab-motivation'],
    ['What does Georgi look like?', 'en', 'about.cats.georgi'],
    ['Wie sehen Timos Katzen aus?', 'de', 'about.cats'],
    [
      'What could people do on the HTL website?',
      'en',
      'htl-dornbirn-class-website',
    ],
  ] as const)('%s reaches %s', (question, locale, id) => {
    expect(reachable(question, locale)).toContain(id);
  });
});
