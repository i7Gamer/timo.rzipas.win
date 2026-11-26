// Pass/fail rules for the packaged model gate. They are pure so the rules
// themselves are unit-tested; evaluate.ts collects the rows.

/**
 * - selectorDeadlineMs: the gateway's internal limit for one model selection
 *   (ASK_SELECTOR_TIMEOUT_MS); past it the gateway answers 503.
 * - warmP95Ms: p95 of successful local answers, end to end over HTTP, once
 *   the model is loaded.
 * - coldEndToEndMs: the first request after a fresh start, end to end.
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
}

export interface ColdProbe {
  httpStatus: number | null;
  status: string;
  mode: string | null;
  ms: number;
}

function percentile(values: readonly number[], share: number) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length
    ? sorted[Math.ceil(sorted.length * share) - 1]
    : undefined;
}

export function modelGate(
  rows: readonly GateRow[],
  cold?: ColdProbe | null,
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
  const local = rows.filter(
    ({ resultMode, status }) => resultMode === 'local' && status !== 'error',
  );
  if (rows.length && !local.length)
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
  if (cold) {
    if (cold.httpStatus !== 200 || cold.mode !== 'local')
      failures.push('cold request was not answered by the local model');
    else if (cold.ms > budget.coldEndToEndMs)
      failures.push(
        `cold request took ${cold.ms} ms, over ${budget.coldEndToEndMs} ms`,
      );
  }
  const counts: Record<string, { answered: number; total: number }> = {};
  for (const { route, match } of rows) {
    counts[route] ??= { answered: 0, total: 0 };
    counts[route].total += 1;
    if (match) counts[route].answered += 1;
  }
  return { passed: !failures.length, failures, p95Ms: p95Ms ?? null, counts };
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
  ms?: number;
  /** Milliseconds after inference resumed. */
  at?: number;
}

const OUTAGE_STATUS = 503;

/**
 * Recovery without restarting the gateway: the outage request must see the
 * outage (503 or a dropped connection, not a quota 429 or a fallback), and a
 * later request must be a local answer.
 */
export function recoveryOutcome({
  duringOutage,
  afterResume,
}: {
  duringOutage: RecoverySample;
  afterResume: readonly RecoverySample[];
}) {
  const index = afterResume.findIndex(
    ({ httpStatus, mode }) => httpStatus === 200 && mode === 'local',
  );
  const sawOutage =
    duringOutage.httpStatus === null ||
    duringOutage.httpStatus === OUTAGE_STATUS;
  const recovered = sawOutage && index >= 0;
  return {
    recovered,
    attempts: recovered ? index + 1 : afterResume.length,
    recoveredAfterMs: recovered ? (afterResume[index].at ?? null) : null,
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
