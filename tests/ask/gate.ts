// Pass/fail rules for the packaged model gate. They are pure so the rules
// themselves are unit-tested; evaluate.ts collects the rows.

/**
 * - selectorDeadlineMs: the gateway's internal limit for one model selection
 *   (ASK_SELECTOR_TIMEOUT_MS); past it the gateway answers 503.
 * - warmP95Ms: p95 of local answers that made a model call, end to end over
 *   HTTP, once the model is loaded.
 * - coldEndToEndMs: the first request after the model was unloaded (and
 *   proven absent from Ollama), end to end.
 */
export const MODEL_GATE = {
  selectorDeadlineMs: 6_000,
  warmP95Ms: 4_000,
  coldEndToEndMs: 6_000,
} as const;
const P95 = 0.95;

export interface GateRow {
  suite: string;
  locale: string;
  route: string;
  httpStatus: number | null;
  status: string;
  resultMode: string | null;
  match: boolean;
  ms: number;
  expectedMode?: string;
  /** Model calls the gateway reports for the request; null when unreported. */
  modelCalls?: number | null;
  /** True for sentinels that only a real model call can answer. */
  requiresModelCall?: boolean;
}

/** The reviewed answer the cold and recovery probes must return. */
export const COLD_EXPECTED = {
  ids: ['spotify-python'],
  citationIds: ['spotify-code'],
} as const;

export interface ColdProbe {
  httpStatus: number | null;
  status: string;
  mode: string | null;
  ms: number;
  ids?: string[];
  citations?: readonly { id: string }[];
  modelCalls?: number | null;
  error?: string;
}

export type Residency = 'resident' | 'unloaded' | 'unknown';

/**
 * Three separate cold-path numbers:
 * - cold: the first request after the model was unloaded and shown absent
 *   from Ollama's /api/ps (budgeted);
 * - startupToReadyMs: gateway restart until it answers (warm-up included);
 * - postReady: the first visitor request after ready, before the unload.
 */
export interface ColdMeasurement {
  /** Model state proven right before the cold clock started. */
  residency: Residency;
  startupToReadyMs: number | null;
  postReady: ColdProbe | null;
  cold: ColdProbe | null;
  error?: string;
}

const sameSet = (actual: readonly string[], expected: readonly string[]) =>
  actual.length === expected.length &&
  expected.every((value) => actual.includes(value));

const isReviewedAnswer = (probe: ColdProbe) =>
  probe.httpStatus === 200 &&
  probe.mode === 'local' &&
  probe.status === 'answer' &&
  sameSet(probe.ids ?? [], COLD_EXPECTED.ids) &&
  sameSet(
    (probe.citations ?? []).map(({ id }) => id),
    COLD_EXPECTED.citationIds,
  );

/** Whether Ollama's /api/ps body lists the model as loaded. */
export function modelResidency(ps: unknown, model: string): Residency {
  if (!ps || typeof ps !== 'object' || !('models' in ps)) return 'unknown';
  const { models } = ps;
  if (!Array.isArray(models)) return 'unknown';
  return models.some(
    (entry: unknown) =>
      entry &&
      typeof entry === 'object' &&
      (('name' in entry && entry.name === model) ||
        ('model' in entry && entry.model === model)),
  )
    ? 'resident'
    : 'unloaded';
}

/** Failures of the cold measurement, enforced by every run that takes one. */
export function coldGate(
  measurement: ColdMeasurement,
  budget: typeof MODEL_GATE = MODEL_GATE,
) {
  const failures: string[] = [];
  if (measurement.error)
    failures.push('cold measurement error: ' + measurement.error);
  if (measurement.residency === 'resident')
    failures.push('cold state not reached: the model was resident');
  else if (measurement.residency === 'unknown')
    failures.push(
      'cold state not proven: model residency could not be proven from /api/ps',
    );
  if (measurement.startupToReadyMs === null)
    failures.push('gateway startup-to-ready time was not measured');
  const { cold, postReady } = measurement;
  if (!cold) failures.push('cold request did not run');
  else {
    if (cold.httpStatus !== 200 || cold.mode !== 'local')
      failures.push('cold request was not answered by the local model');
    else if (!isReviewedAnswer(cold))
      failures.push('cold answer was not the reviewed claim and citation');
    if (cold.modelCalls === 0) failures.push('cold request made no model call');
    else if (cold.modelCalls == null)
      failures.push('cold request did not report model calls');
    if (cold.ms > budget.coldEndToEndMs)
      failures.push(
        `cold request took ${cold.ms} ms, over ${budget.coldEndToEndMs} ms`,
      );
  }
  if (!postReady) failures.push('post-ready visitor request did not run');
  else if (!isReviewedAnswer(postReady))
    failures.push(
      'post-ready visitor request was not the reviewed local answer',
    );
  return failures;
}

function percentile(values: readonly number[], share: number) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length
    ? sorted[Math.ceil(sorted.length * share) - 1]
    : undefined;
}

/**
 * `cold` undefined means the run took no cold measurement: the result is
 * then `partial` and never `passed`.
 */
export function modelGate(
  rows: readonly GateRow[],
  cold?: ColdMeasurement | null,
  budget: typeof MODEL_GATE = MODEL_GATE,
) {
  const failures: string[] = [];
  const sentinels = rows.filter(({ expectedMode }) => expectedMode === 'local');
  if (!sentinels.length) failures.push('no local-model sentinel case ran');
  const missed = sentinels.filter(({ match }) => !match).length;
  if (missed)
    failures.push(
      `${missed}/${sentinels.length} sentinel cases missed the reviewed local answer`,
    );
  const answered = rows.filter(
    ({ resultMode, status }) => resultMode === 'local' && status !== 'error',
  );
  // Inference latency covers requests that really called the model, so a
  // cheap local-mode abstention cannot improve it.
  const local = answered.filter(({ modelCalls }) => (modelCalls ?? 0) > 0);
  const required = rows.filter(({ requiresModelCall }) => requiresModelCall);
  const unreported = required.filter(({ modelCalls }) => modelCalls == null);
  const idle = required.filter(({ modelCalls }) => modelCalls === 0);
  if (unreported.length)
    failures.push(
      `${unreported.length}/${required.length} model cases did not report model calls`,
    );
  if (idle.length)
    failures.push(
      `${idle.length}/${required.length} model cases made no model call; a local answer without inference proves nothing`,
    );
  if (rows.length && !answered.length)
    failures.push('no request was answered by the local model');
  const fallbacks = sentinels.filter(
    ({ resultMode }) => resultMode === 'index',
  ).length;
  if (fallbacks)
    failures.push(
      `${fallbacks}/${sentinels.length} local-model requests fell back to the index`,
    );
  const failed = rows.filter(({ httpStatus }) => httpStatus !== 200).length;
  if (failed)
    failures.push(`${failed}/${rows.length} requests timed out or failed`);
  const p95Ms = percentile(
    local.map(({ ms }) => ms),
    P95,
  );
  if (p95Ms !== undefined && p95Ms > budget.warmP95Ms)
    failures.push(
      `warm p95 ${p95Ms} ms is over the ${budget.warmP95Ms} ms budget`,
    );
  if (cold) failures.push(...coldGate(cold, budget));
  const counts: Record<string, { answered: number; total: number }> = {};
  for (const { route, match } of rows) {
    counts[route] ??= { answered: 0, total: 0 };
    counts[route].total += 1;
    if (match) counts[route].answered += 1;
  }
  return {
    passed: !failures.length && Boolean(cold),
    partial: !cold,
    failures,
    p95Ms: p95Ms ?? null,
    counts,
  };
}

/** The headline for a gate result; only a complete clean run says passed. */
export function gateLabel(result: ReturnType<typeof modelGate>) {
  if (result.passed) return 'model gate passed';
  if (result.failures.length)
    return (
      'model gate FAILED' +
      (result.partial ? ' (partial run, no cold measurement)' : '')
    );
  return 'model gate PARTIAL: no cold measurement, not a pass';
}

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);
const ANY_ADDRESS = new Set(['0.0.0.0', '[::]', '::']);

/**
 * Whether `docker compose port website 80` output publishes the origin being
 * evaluated, so a reset can only touch the stack that is being measured.
 */
export function publishedPortMatches(output: string, origin: string) {
  const published = /^(.+):(\d+)$/.exec(output.trim());
  const url = new URL(origin);
  if (!published || !url.port) return false;
  const [, host, port] = published;
  const sameHost =
    ANY_ADDRESS.has(host) ||
    host === url.hostname ||
    (LOOPBACK.has(host) && LOOPBACK.has(url.hostname));
  return sameHost && port === url.port;
}

export interface RecoverySample {
  httpStatus: number | null;
  mode: string | null;
  status?: string;
  ids?: string[];
  citations?: string[];
  modelCalls?: number | null;
  ms?: number;
  /** Milliseconds after inference resumed. */
  at?: number;
}

const OUTAGE_STATUS = 503;

const isCanonical = (sample: RecoverySample) =>
  isReviewedAnswer({
    httpStatus: sample.httpStatus,
    mode: sample.mode,
    status: sample.status ?? '',
    ms: sample.ms ?? 0,
    ids: sample.ids,
    citations: sample.citations?.map((id) => ({ id })),
  });

/**
 * Recovery without restarting the gateway: the same canonical claim and
 * citation before the outage and after resume, with a real outage (503 or a
 * dropped connection, not a quota 429 or a fallback) in between. A local
 * answer without that claim does not count as recovered.
 */
export function recoveryOutcome({
  before,
  duringOutage,
  afterResume,
}: {
  before: RecoverySample | null;
  duringOutage: RecoverySample;
  afterResume: readonly RecoverySample[];
}) {
  const failures: string[] = [];
  if (!before || !isCanonical(before))
    failures.push(
      'the answer before the outage was not the canonical claim and citation',
    );
  const sawOutage =
    duringOutage.httpStatus === null ||
    duringOutage.httpStatus === OUTAGE_STATUS;
  if (!sawOutage)
    failures.push(
      `the outage request did not see an outage (HTTP ${duringOutage.httpStatus})`,
    );
  const index = afterResume.findIndex(isCanonical);
  if (index < 0) failures.push('no canonical answer after the outage ended');
  const recovered = !failures.length;
  return {
    recovered,
    attempts: recovered ? index + 1 : afterResume.length,
    recoveredAfterMs: recovered ? (afterResume[index].at ?? null) : null,
    failures,
  };
}

const GATEWAY_STARTED = 'Ask gateway on ';
const WARMUP_READY = 'Ask chat ready';
const WARMUP_FAILED = 'Ask chat warm-up failed';

/**
 * Warm-up state of the latest gateway start in its log. With ASK_WARMUP=on
 * the gateway answers 503 until warm-up ends, although HTTP is already up.
 */
export function warmupState(logs: string): 'pending' | 'ready' | 'failed' {
  const start = logs.lastIndexOf(GATEWAY_STARTED);
  if (start < 0) return 'pending';
  const latest = logs.slice(start);
  if (latest.includes(WARMUP_READY)) return 'ready';
  return latest.includes(WARMUP_FAILED) ? 'failed' : 'pending';
}
