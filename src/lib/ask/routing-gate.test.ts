import { describe, expect, it } from 'vitest';
import { assertRoutingExpectations } from './routing-gate.ts';
import { facts } from './catalog.ts';

const routingExpectations = [
  {
    locale: 'en',
    question: 'How many genres does Last.fm provide?',
    status: 'partial',
    acceptableIds: [['spotify-enrichment']],
  },
  {
    locale: 'de',
    question: 'Wie viele Genres liefert Last.fm?',
    status: 'partial',
    acceptableIds: [['spotify-enrichment']],
  },
  {
    locale: 'en',
    question: 'What is Timo working on now?',
    status: 'answer',
    acceptableIds: [['current-work']],
  },
  {
    locale: 'de',
    question: 'Woran arbeitet Timo gerade?',
    status: 'answer',
    acceptableIds: [['current-work']],
  },
  ...Array.from({ length: 4 }, (_, index) => ({
    locale: 'en',
    question: `unknown ${index}`,
    status: 'unknown',
    acceptableIds: [[]],
  })),
];

describe('routing expectation guard', () => {
  it('accepts the versioned four-unknown routing set and dated snapshot evidence', () => {
    expect(() => assertRoutingExpectations(routingExpectations)).not.toThrow();
  });

  it('fails if the exact unknown count changes', () => {
    const changed = routingExpectations.filter(
      ({ question }) => question !== 'unknown 0',
    );
    expect(() => assertRoutingExpectations(changed)).toThrow(/unknown count/);
  });

  it('fails if dated activity is changed to missing evidence', () => {
    const changed = routingExpectations.map((fixture) =>
      fixture.question === 'What is Timo working on now?'
        ? { ...fixture, acceptableIds: [[]] }
        : fixture,
    );
    expect(() => assertRoutingExpectations(changed)).toThrow(
      /current-work snapshot/,
    );
  });

  it('fails if the English count is treated as fully answered', () => {
    const changed = routingExpectations.map((fixture) =>
      fixture.question === 'How many genres does Last.fm provide?'
        ? { ...fixture, status: 'answer' }
        : fixture,
    );
    expect(() => assertRoutingExpectations(changed)).toThrow(
      /genre count is unknown/,
    );
  });

  it('fails if the current-work wording loses its reviewed date', () => {
    const changed = facts.map((fact) =>
      fact.id === 'current-work'
        ? { ...fact, answer: { ...fact.answer, en: 'Timo works at Abacus.' } }
        : fact,
    );
    expect(() =>
      assertRoutingExpectations(routingExpectations, changed),
    ).toThrow(/reviewed date/);
  });
});
