// Pure helpers for the fixed-candidate selector evaluation: the model gets a
// known candidate list (expected facts plus same-source distractors) in
// several orders, separate from routing and retrieval.
import { facts, type Fact } from '../../src/lib/ask/catalog.ts';

export interface ExpectedFixture {
  status: string;
  acceptableIds: readonly (readonly string[])[];
}

/** Fact ids start with their project or employer, e.g. spotify-python. */
export const projectOf = (id: string) => id.split('-')[0];

/** Expected facts first, then same-project distractors, for each list size. */
export function candidateSets(
  fixture: ExpectedFixture,
  sizes: readonly number[],
) {
  const expectedIds = fixture.acceptableIds[0] ?? [];
  if (fixture.status === 'unknown' || !expectedIds.length) return [];
  const excluded = new Set(fixture.acceptableIds.flat());
  const expected = expectedIds.map((id) =>
    facts.find((fact) => fact.id === id)!,
  );
  const projects = new Set(expected.map(({ id }) => projectOf(id)));
  const distractors = facts.filter(
    ({ id }) => projects.has(projectOf(id)) && !excluded.has(id),
  );
  return sizes.flatMap((size) =>
    size >= expected.length && size - expected.length <= distractors.length
      ? [
          {
            size,
            facts: [
              ...expected,
              ...distractors.slice(0, size - expected.length),
            ] as Fact[],
          },
        ]
      : [],
  );
}

/** Small deterministic generator (mulberry32) for repeatable shuffles. */
function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 2 ** 32;
  };
}

/** Natural, reversed and seeded shuffles of a list, without repeats. */
export function orderings<T>(
  items: readonly T[],
  shuffles: number,
  seed: number,
) {
  const next = random(seed);
  const candidates = [
    { label: 'natural', items: [...items] },
    { label: 'reversed', items: [...items].reverse() },
    ...Array.from({ length: shuffles }, (_, index) => {
      const order = [...items];
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      return { label: `shuffle-${index + 1}`, items: order };
    }),
  ];
  const seen = new Set<string>();
  return candidates.filter(({ items: order }) => {
    const key = JSON.stringify(order);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** True when the selected ids equal one acceptable set, in any order. */
export function selectionMatches(
  selected: readonly string[],
  acceptable: readonly (readonly string[])[],
) {
  return acceptable.some(
    (ids) =>
      ids.length === selected.length &&
      ids.every((id) => selected.includes(id)),
  );
}

/** The visitor-facing status: a selected partial fact makes it partial. */
export function effectiveStatus(
  decision: { status: string; slots: readonly number[] },
  selected: readonly Fact[],
) {
  return decision.status === 'answer' && selected.some(({ partial }) => partial)
    ? 'partial'
    : decision.status;
}

/** A question is order-sensitive when its orders disagree on correctness. */
export function orderSensitive(results: readonly boolean[]) {
  return new Set(results).size > 1;
}

interface Tally {
  correct: number;
  total: number;
}

/** Accuracy overall, per list size and per order, plus unstable questions. */
export function summarize(
  rows: readonly {
    question: string;
    size: number;
    order: string;
    correct: boolean;
  }[],
) {
  const tally = (into: Record<string, Tally>, key: string, ok: boolean) => {
    into[key] ??= { correct: 0, total: 0 };
    into[key].total += 1;
    if (ok) into[key].correct += 1;
  };
  const overall = { correct: 0, total: 0 };
  const bySize: Record<string, Tally> = {};
  const byOrder: Record<string, Tally> = {};
  const groups = new Map<
    string,
    { question: string; size: number; results: boolean[] }
  >();
  for (const { question, size, order, correct } of rows) {
    overall.total += 1;
    if (correct) overall.correct += 1;
    tally(bySize, String(size), correct);
    tally(byOrder, order, correct);
    const key = JSON.stringify([question, size]);
    const group = groups.get(key) ?? { question, size, results: [] };
    group.results.push(correct);
    groups.set(key, group);
  }
  return {
    overall,
    bySize,
    byOrder,
    orderSensitive: [...groups.values()]
      .filter(({ results }) => orderSensitive(results))
      .map(({ question, size }) => ({ question, size })),
  };
}
