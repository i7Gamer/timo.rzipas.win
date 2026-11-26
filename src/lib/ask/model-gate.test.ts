import { describe, expect, it } from 'vitest';
import {
  MODEL_GATE,
  modelGate,
  publishedPortMatches,
  recoveryOutcome,
  type GateRow,
} from '../../../tests/ask/gate.ts';

const row = (overrides: Partial<GateRow> = {}): GateRow => ({
  suite: 'sentinel',
  locale: 'en',
  route: 'http-local',
  httpStatus: 200,
  status: 'answer',
  resultMode: 'local',
  match: true,
  ms: 2_000,
  expectedMode: 'local',
  ...overrides,
});
const coldOk = { httpStatus: 200, status: 'answer', mode: 'local', ms: 5_000 };

describe('model gate budgets', () => {
  it('defines the three time limits separately', () => {
    expect(MODEL_GATE).toEqual({
      selectorDeadlineMs: 6_000,
      warmP95Ms: 4_000,
      coldEndToEndMs: 6_000,
    });
  });
});

describe('model gate', () => {
  it('passes correct local answers within budget', () => {
    const result = modelGate([row(), row({ locale: 'de' })], coldOk);
    expect(result.passed).toBe(true);
    expect(result.failures).toEqual([]);
    expect(result.counts).toEqual({
      'http-local': { answered: 2, total: 2 },
    });
  });

  it('fails when every answer came from the index', () => {
    const result = modelGate([
      row({ route: 'http-index', resultMode: 'index', match: false }),
      row({ route: 'http-index', resultMode: 'index', match: false }),
    ]);
    expect(result.passed).toBe(false);
    expect(result.failures).toEqual(
      expect.arrayContaining([
        'no request was answered by the local model',
        '2/2 local-model requests fell back to the index',
      ]),
    );
  });

  it('fails on timeouts and reports them with their total', () => {
    const result = modelGate([
      row(),
      row({
        route: 'http-outage',
        httpStatus: 503,
        status: 'error',
        resultMode: null,
        match: false,
      }),
    ]);
    expect(result.failures).toContain('1/2 requests timed out or failed');
    expect(result.counts['http-outage']).toEqual({ answered: 0, total: 1 });
  });

  it('fails when warm p95 is over budget', () => {
    const result = modelGate([row({ ms: 3_000 }), row({ ms: 4_500 })]);
    expect(result.p95Ms).toBe(4_500);
    expect(result.failures).toContain(
      'warm p95 4500 ms is over the 4000 ms budget',
    );
  });

  it('fails when a sentinel gets a wrong local answer', () => {
    const result = modelGate([row(), row({ match: false })]);
    expect(result.failures).toContain(
      '1/2 sentinel cases missed the reviewed local answer',
    );
  });

  it('fails without any sentinel case', () => {
    expect(modelGate([]).failures).toContain(
      'no local-model sentinel case ran',
    );
  });

  it.each([
    [{ ...coldOk, ms: 6_500 }, 'cold request took 6500 ms, over 6000 ms'],
    [
      { ...coldOk, httpStatus: 503, mode: null, status: 'outage' },
      'cold request was not answered by the local model',
    ],
  ])('checks the cold request separately', (cold, failure) => {
    expect(modelGate([row()], cold).failures).toContain(failure);
  });

  it('does not check cold timing without a cold probe', () => {
    expect(modelGate([row()]).passed).toBe(true);
  });
});

describe('reset target binding', () => {
  it.each([
    ['127.0.0.1:18093\n', 'http://127.0.0.1:18093'],
    ['127.0.0.1:18093', 'http://localhost:18093'],
    ['0.0.0.0:18093', 'http://127.0.0.1:18093'],
  ])('accepts %j for %j', (output, origin) => {
    expect(publishedPortMatches(output, origin)).toBe(true);
  });

  it.each([
    ['127.0.0.1:18094', 'http://127.0.0.1:18093'],
    ['', 'http://127.0.0.1:18093'],
    ['192.168.1.5:18093', 'http://127.0.0.1:18093'],
    ['127.0.0.1:18093', 'http://127.0.0.1'],
  ])('refuses %j for %j', (output, origin) => {
    expect(publishedPortMatches(output, origin)).toBe(false);
  });
});

describe('recovery outcome', () => {
  it('recovers on the first local answer after the outage', () => {
    expect(
      recoveryOutcome({
        duringOutage: { httpStatus: 503, mode: null },
        afterResume: [
          { httpStatus: 503, mode: null, ms: 6_000, at: 6_000 },
          { httpStatus: 200, mode: 'local', ms: 3_000, at: 20_000 },
        ],
      }),
    ).toEqual({ recovered: true, attempts: 2, recoveredAfterMs: 20_000 });
  });

  it('fails when the outage still produced a local answer', () => {
    expect(
      recoveryOutcome({
        duringOutage: { httpStatus: 200, mode: 'local' },
        afterResume: [{ httpStatus: 200, mode: 'local', ms: 3_000, at: 1 }],
      }).recovered,
    ).toBe(false);
  });

  it('fails when no local answer follows', () => {
    expect(
      recoveryOutcome({
        duringOutage: { httpStatus: 503, mode: null },
        afterResume: [{ httpStatus: 200, mode: 'index', ms: 50, at: 1 }],
      }),
    ).toEqual({ recovered: false, attempts: 1, recoveredAfterMs: null });
  });
});
