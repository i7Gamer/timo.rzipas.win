import { describe, expect, it } from 'vitest';
import {
  COLD_EXPECTED,
  coldGate,
  gateLabel,
  MODEL_GATE,
  modelGate,
  modelResidency,
  publishedPortMatches,
  recoveryOutcome,
  type ColdMeasurement,
  type ColdProbe,
  type GateRow,
  type RecoverySample,
  warmupState,
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
  modelCalls: 1,
  requiresModelCall: true,
  ...overrides,
});
const probe = (overrides: Partial<ColdProbe> = {}): ColdProbe => ({
  httpStatus: 200,
  status: 'answer',
  mode: 'local',
  ms: 5_000,
  ids: [...COLD_EXPECTED.ids],
  citations: COLD_EXPECTED.citationIds.map((id) => ({ id })),
  modelCalls: 1,
  ...overrides,
});
const measured = (
  overrides: Partial<ColdMeasurement> = {},
): ColdMeasurement => ({
  residency: 'unloaded',
  startupToReadyMs: 12_000,
  postReady: probe({ ms: 2_500 }),
  cold: probe(),
  ...overrides,
});
const coldOk = measured();

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

  it('does not pass without a cold measurement and labels the run partial', () => {
    const result = modelGate([row()]);
    expect(result.failures).toEqual([]);
    expect(result.partial).toBe(true);
    expect(result.passed).toBe(false);
  });

  it('is complete and passed with a clean cold measurement', () => {
    const result = modelGate([row()], coldOk);
    expect(result.partial).toBe(false);
    expect(result.passed).toBe(true);
  });

  it('adds cold failures to the gate', () => {
    const result = modelGate([row()], measured({ cold: probe({ ms: 6_500 }) }));
    expect(result.passed).toBe(false);
    expect(result.failures).toContain(
      'cold request took 6500 ms, over 6000 ms',
    );
  });

  it('fails a sentinel that made no model call', () => {
    const result = modelGate([row({ modelCalls: 0 }), row()], coldOk);
    expect(result.failures).toContain(
      '1/2 model cases made no model call; a local answer without inference proves nothing',
    );
  });

  it('fails a sentinel when the gateway did not report model calls', () => {
    const result = modelGate([row({ modelCalls: null })], coldOk);
    expect(result.failures).toContain(
      '1/1 model cases did not report model calls',
    );
  });

  it('keeps an abstention that needs no model out of the inference p95', () => {
    const abstention = row({
      suite: 'packaged-abstention',
      status: 'unknown',
      ms: 10,
      modelCalls: 0,
      requiresModelCall: false,
    });
    const slow = row({ ms: 4_500 });
    const result = modelGate(
      [abstention, abstention, abstention, slow],
      coldOk,
    );
    expect(result.p95Ms).toBe(4_500);
    expect(result.failures).toContain(
      'warm p95 4500 ms is over the 4000 ms budget',
    );
  });

  it('reports no p95 when no request made a model call', () => {
    const cheap = row({ modelCalls: 0, requiresModelCall: false });
    expect(modelGate([cheap], coldOk).p95Ms).toBeNull();
  });
});

describe('gate label', () => {
  it('says passed only for a complete clean run', () => {
    expect(gateLabel(modelGate([row()], coldOk))).toBe('model gate passed');
  });

  it('never says passed for a warm-only run', () => {
    const label = gateLabel(modelGate([row()]));
    expect(label).not.toContain('passed');
    expect(label).toContain('PARTIAL');
    expect(label).toContain('not a pass');
  });

  it('says FAILED for failures, with the partial note when warm-only', () => {
    expect(gateLabel(modelGate([row({ match: false })], coldOk))).toBe(
      'model gate FAILED',
    );
    expect(gateLabel(modelGate([row({ match: false })]))).toBe(
      'model gate FAILED (partial run, no cold measurement)',
    );
  });
});

describe('cold gate', () => {
  it('passes a proven unloaded, correct, in-budget cold request', () => {
    expect(coldGate(coldOk)).toEqual([]);
  });

  it('accepts exactly the budget', () => {
    expect(
      coldGate(measured({ cold: probe({ ms: MODEL_GATE.coldEndToEndMs }) })),
    ).toEqual([]);
  });

  it('fails one millisecond over the budget', () => {
    expect(
      coldGate(
        measured({ cold: probe({ ms: MODEL_GATE.coldEndToEndMs + 1 }) }),
      ),
    ).toContain('cold request took 6001 ms, over 6000 ms');
  });

  it.each([
    ['resident', 'model was resident'],
    ['unknown', 'model residency could not be proven'],
  ] as const)('fails when residency is %s', (residency, text) => {
    expect(coldGate(measured({ residency })).join()).toContain(text);
  });

  it('fails when the cold request did not run', () => {
    expect(coldGate(measured({ cold: null }))).toContain(
      'cold request did not run',
    );
  });

  it.each([
    [probe({ httpStatus: 503, mode: null, status: 'outage' })],
    [probe({ mode: 'index' })],
    [probe({ httpStatus: null, mode: null, status: 'outage' })],
  ])('fails a cold request that was not a local answer', (cold) => {
    expect(coldGate(measured({ cold }))).toContain(
      'cold request was not answered by the local model',
    );
  });

  it.each([
    [probe({ ids: ['spotify-recovery'] })],
    [probe({ ids: [] })],
    [probe({ citations: [] })],
    [probe({ status: 'partial' })],
  ])('fails a local cold answer that is not the reviewed one', (cold) => {
    expect(coldGate(measured({ cold }))).toContain(
      'cold answer was not the reviewed claim and citation',
    );
  });

  it('fails a cold request without a model call', () => {
    expect(coldGate(measured({ cold: probe({ modelCalls: 0 }) }))).toContain(
      'cold request made no model call',
    );
    expect(coldGate(measured({ cold: probe({ modelCalls: null }) }))).toContain(
      'cold request did not report model calls',
    );
  });

  it('checks the post-ready visitor request separately', () => {
    expect(coldGate(measured({ postReady: null }))).toContain(
      'post-ready visitor request did not run',
    );
    expect(coldGate(measured({ postReady: probe({ ids: [] }) }))).toContain(
      'post-ready visitor request was not the reviewed local answer',
    );
  });

  it('fails when the gateway never reported ready', () => {
    expect(coldGate(measured({ startupToReadyMs: null }))).toContain(
      'gateway startup-to-ready time was not measured',
    );
  });

  it('keeps the cold error as a diagnostic', () => {
    expect(coldGate(measured({ error: 'docker exploded' }))).toContain(
      'cold measurement error: docker exploded',
    );
  });
});

describe('model residency', () => {
  it.each([
    [{ models: [{ name: 'qwen3:1.7b', model: 'qwen3:1.7b' }] }, 'resident'],
    [{ models: [{ model: 'qwen3:1.7b' }] }, 'resident'],
    [{ models: [{ name: 'qwen3:1.7b' }] }, 'resident'],
    [{ models: [{ name: 'other:1b' }] }, 'unloaded'],
    [{ models: [] }, 'unloaded'],
    [{}, 'unknown'],
    [{ models: 'x' }, 'unknown'],
    [null, 'unknown'],
    ['nope', 'unknown'],
  ] as const)('reads /api/ps %j as %s', (ps, expected) => {
    expect(modelResidency(ps, 'qwen3:1.7b')).toBe(expected);
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
  const good = (overrides: Partial<RecoverySample> = {}): RecoverySample => ({
    httpStatus: 200,
    mode: 'local',
    status: 'answer',
    ids: [...COLD_EXPECTED.ids],
    citations: [...COLD_EXPECTED.citationIds],
    ms: 3_000,
    ...overrides,
  });
  const outage: RecoverySample = { httpStatus: 503, mode: null };

  it('recovers on the first canonical answer after a real outage', () => {
    expect(
      recoveryOutcome({
        before: good(),
        duringOutage: outage,
        afterResume: [
          { httpStatus: 503, mode: null, ms: 6_000, at: 6_000 },
          good({ at: 20_000 }),
        ],
      }),
    ).toEqual({
      recovered: true,
      attempts: 2,
      recoveredAfterMs: 20_000,
      failures: [],
    });
  });

  it('does not count a local unknown answer without claims as recovered', () => {
    const result = recoveryOutcome({
      before: good(),
      duringOutage: outage,
      afterResume: [good({ status: 'unknown', ids: [], citations: [], at: 1 })],
    });
    expect(result.recovered).toBe(false);
    expect(result.recoveredAfterMs).toBeNull();
    expect(result.failures).toContain(
      'no canonical answer after the outage ended',
    );
  });

  it.each([
    ['wrong claim', good({ ids: ['spotify-recovery'], at: 1 })],
    ['missing citation', good({ citations: [], at: 1 })],
    ['extra claim', good({ ids: ['spotify-python', 'spotify-recovery'] })],
    ['index fallback', good({ mode: 'index', at: 1 })],
    ['partial', good({ status: 'partial', at: 1 })],
  ])('does not accept %s after the outage', (_name, sample) => {
    expect(
      recoveryOutcome({
        before: good(),
        duringOutage: outage,
        afterResume: [sample],
      }).recovered,
    ).toBe(false);
  });

  it('fails when the answer before the outage was not canonical', () => {
    const result = recoveryOutcome({
      before: good({ ids: [] }),
      duringOutage: outage,
      afterResume: [good({ at: 1 })],
    });
    expect(result.recovered).toBe(false);
    expect(result.failures).toContain(
      'the answer before the outage was not the canonical claim and citation',
    );
  });

  it('fails when there is no before sample', () => {
    expect(
      recoveryOutcome({
        before: null,
        duringOutage: outage,
        afterResume: [good({ at: 1 })],
      }).recovered,
    ).toBe(false);
  });

  it('fails when the outage request still got a local answer', () => {
    const result = recoveryOutcome({
      before: good(),
      duringOutage: good(),
      afterResume: [good({ at: 1 })],
    });
    expect(result.recovered).toBe(false);
    expect(result.failures).toContain(
      'the outage request did not see an outage (HTTP 200)',
    );
  });

  it.each([429, 200])(
    'fails when the outage request got %s instead of an outage',
    (httpStatus) => {
      expect(
        recoveryOutcome({
          before: good(),
          duringOutage: {
            httpStatus,
            mode: httpStatus === 200 ? 'index' : null,
          },
          afterResume: [good({ at: 1 })],
        }).recovered,
      ).toBe(false);
    },
  );

  it('accepts a dropped connection as the outage', () => {
    const result = recoveryOutcome({
      before: good(),
      duringOutage: { httpStatus: null, mode: null },
      afterResume: [good({ at: 1 })],
    });
    expect(result.recovered).toBe(true);
  });

  it('fails with the attempt count when nothing recovers', () => {
    expect(
      recoveryOutcome({
        before: good(),
        duringOutage: outage,
        afterResume: [{ httpStatus: 200, mode: 'index', ms: 50, at: 1 }],
      }),
    ).toMatchObject({ recovered: false, attempts: 1, recoveredAfterMs: null });
  });
});

describe('gateway warm-up state', () => {
  it.each([
    ['', 'pending'],
    ['Ask gateway on http://0.0.0.0:4513\n', 'pending'],
    ['Ask gateway on http://0.0.0.0:4513\nAsk chat ready\n', 'ready'],
    ['Ask gateway on x\nAsk chat ready\nAsk gateway on x\n', 'pending'],
    [
      'Ask gateway on x\nAsk chat warm-up failed; reviewed answers remain available\n',
      'failed',
    ],
    [
      'Ask gateway on x\nAsk chat warm-up failed; x\nAsk gateway on x\nAsk chat ready\n',
      'ready',
    ],
  ])('reads the latest start in %j as %s', (logs, state) => {
    expect(warmupState(logs)).toBe(state);
  });
});
