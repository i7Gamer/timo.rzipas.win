import { describe, expect, it } from 'vitest';
import {
  candidateSets,
  effectiveStatus,
  orderings,
  orderSensitive,
  projectOf,
  selectionMatches,
  summarize,
} from '../../../tests/ask/fixed-candidates.ts';
import { facts } from './catalog';

const byId = (id: string) => facts.find((fact) => fact.id === id)!;
const ids = (list: readonly { id: string }[]) => list.map(({ id }) => id);

describe('fixed candidate sets', () => {
  const fixture = {
    status: 'answer',
    acceptableIds: [['spotify-python']],
  };

  it('starts with the expected facts and adds same-project distractors', () => {
    const sets = candidateSets(fixture, [1, 3]);
    expect(sets.map(({ size }) => size)).toEqual([1, 3]);
    expect(ids(sets[0].facts)).toEqual(['spotify-python']);
    const [expected, ...distractors] = sets[1].facts;
    expect(expected.id).toBe('spotify-python');
    expect(distractors).toHaveLength(2);
    for (const fact of distractors) {
      expect(projectOf(fact.id)).toBe('spotify');
      expect(fact.id).not.toBe('spotify-python');
    }
  });

  it('takes the project from the fact id prefix', () => {
    expect(projectOf('hearthcoil-rules-testing')).toBe('hearthcoil');
    expect(projectOf('cv')).toBe('cv');
  });

  it('never uses a fact from any acceptable answer as a distractor', () => {
    const sets = candidateSets(
      {
        status: 'answer',
        acceptableIds: [['spotify-python'], ['spotify-rewrite']],
      },
      [3],
    );
    expect(ids(sets[0].facts).filter((id) => id === 'spotify-rewrite')).toEqual(
      [],
    );
  });

  it('skips sizes the source cannot fill or that drop expected facts', () => {
    const many = facts.filter(({ id }) => projectOf(id) === 'spotify').length;
    const sets = candidateSets(fixture, [0, many + 1]);
    expect(sets).toEqual([]);
  });

  it('builds no sets for an unknown expectation', () => {
    expect(
      candidateSets({ status: 'unknown', acceptableIds: [[]] }, [1, 3]),
    ).toEqual([]);
  });
});

describe('candidate orders', () => {
  it('lists natural, reversed and seeded shuffles without duplicates', () => {
    const items = ['a', 'b', 'c', 'd'];
    const orders = orderings(items, 2, 7);
    expect(orders[0]).toEqual({ label: 'natural', items });
    expect(orders[1]).toEqual({
      label: 'reversed',
      items: ['d', 'c', 'b', 'a'],
    });
    expect(orders.slice(2).map(({ label }) => label)).toEqual(
      ['shuffle-1', 'shuffle-2'].slice(0, orders.length - 2),
    );
    for (const { items: order } of orders)
      expect([...order].sort()).toEqual(items);
    const keys = orders.map(({ items: order }) => order.join());
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('is deterministic for a seed', () => {
    expect(orderings([1, 2, 3, 4, 5], 2, 11)).toEqual(
      orderings([1, 2, 3, 4, 5], 2, 11),
    );
  });

  it('returns a single order for one item', () => {
    expect(orderings(['only'], 3, 1)).toEqual([
      { label: 'natural', items: ['only'] },
    ]);
  });
});

describe('scoring', () => {
  it('matches any acceptable set regardless of order', () => {
    const acceptable = [['a', 'b'], ['c']];
    expect(selectionMatches(['b', 'a'], acceptable)).toBe(true);
    expect(selectionMatches(['c'], acceptable)).toBe(true);
    expect(selectionMatches(['a'], acceptable)).toBe(false);
    expect(selectionMatches(['a', 'b', 'c'], acceptable)).toBe(false);
  });

  it('marks a selection partial when the model or a fact says so', () => {
    expect(
      effectiveStatus({ status: 'answer', slots: [1] }, [
        byId('spotify-python'),
      ]),
    ).toBe('answer');
    expect(
      effectiveStatus({ status: 'partial', slots: [1] }, [
        byId('spotify-python'),
      ]),
    ).toBe('partial');
    expect(
      effectiveStatus({ status: 'answer', slots: [1] }, [
        byId('stadler-start-month'),
      ]),
    ).toBe('partial');
    expect(effectiveStatus({ status: 'unknown', slots: [] }, [])).toBe(
      'unknown',
    );
  });

  it('summarises accuracy per size and order and lists sensitive questions', () => {
    const rows = [
      { question: 'q1', size: 1, order: 'natural', correct: true },
      { question: 'q1', size: 3, order: 'natural', correct: true },
      { question: 'q1', size: 3, order: 'reversed', correct: false },
      { question: 'q2', size: 1, order: 'natural', correct: false },
      { question: 'q2', size: 3, order: 'natural', correct: false },
      { question: 'q2', size: 3, order: 'reversed', correct: false },
    ];
    expect(summarize(rows)).toEqual({
      overall: { correct: 2, total: 6 },
      bySize: { 1: { correct: 1, total: 2 }, 3: { correct: 1, total: 4 } },
      byOrder: {
        natural: { correct: 2, total: 4 },
        reversed: { correct: 0, total: 2 },
      },
      orderSensitive: [{ question: 'q1', size: 3 }],
    });
  });

  it('summarises an empty run', () => {
    expect(summarize([])).toEqual({
      overall: { correct: 0, total: 0 },
      bySize: {},
      byOrder: {},
      orderSensitive: [],
    });
  });

  it('flags a question whose result depends on the order', () => {
    expect(orderSensitive([true, true, true])).toBe(false);
    expect(orderSensitive([false, false])).toBe(false);
    expect(orderSensitive([true, false, true])).toBe(true);
  });
});
