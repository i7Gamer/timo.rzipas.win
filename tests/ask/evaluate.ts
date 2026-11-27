import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { promisify } from 'node:util';
import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Locale } from '../../src/i18n';
import {
  CLIENT_TIMEOUT,
  facts,
  validateResult,
  type AskResult,
} from '../../src/lib/ask/catalog.ts';
import { corpusVersion } from '../../src/lib/ask/version.ts';
import { graniteRanker } from '../../services/ask/granite.ts';
import {
  graniteLocal,
  localPorts,
  LOOPBACK,
} from '../../services/ask/local-profile.ts';
import {
  MODEL,
  MODEL_DIGEST,
  ollamaThreads,
  SELECTOR_CONTEXT_TOKENS,
  selectWithOllama,
  setOllamaCallListener,
  type OllamaCall,
} from '../../services/ask/ollama.ts';
import {
  historyTurns,
  parseQuestionSet,
  type HistoryEntry,
} from './question-set.ts';
import { askModel, prepareQuestion } from '../../services/ask/selection.ts';
import { createGateway } from '../../services/ask/server.ts';
import {
  approvedAnswers,
  approvedExpectation,
} from './approved-expectations.ts';
import heldOut from './held-out.json' with { type: 'json' };
import paraphrases from './paraphrases.json' with { type: 'json' };
import questions from './questions.json' with { type: 'json' };
import routing from './routing.json' with { type: 'json' };
import { assertRoutingExpectations } from '../../src/lib/ask/routing-gate.ts';
import {
  MODEL_GATE,
  modelGate,
  publishedPortMatches,
  recoveryOutcome,
  type RecoverySample,
  warmupState,
} from './gate.ts';

const LEXICAL_TIMEOUT_MS = 6_000;
const PRIME_TIMEOUT_MS = 45_000;
const WARM_PERCENTILE = 0.95;
const HTTP_STARTUP_TIMEOUT_MS = 30_000;
const HTTP_POLL_INTERVAL_MS = 500;
const PACKAGED_RETRIEVAL_QUOTA = 4;
const execFileAsync = promisify(execFile);
const PACKAGED_COLD_QUESTION = 'Which project used Flask?';
const PACKAGED_WARM_FIXTURES: Fixture[] = [
  {
    suite: 'packaged-warm',
    locale: 'en',
    question: 'Can you point me to a project where Timo used Python and Flask?',
    status: 'answer',
    acceptableIds: [['spotify-python']],
    expectedMode: 'local',
  },
  {
    suite: 'packaged-warm',
    locale: 'de',
    question: 'In welchem Projekt hat Timo Python und Flask eingesetzt?',
    status: 'answer',
    acceptableIds: [['spotify-python']],
    expectedMode: 'local',
  },
  {
    suite: 'packaged-abstention',
    locale: 'en',
    question: 'What is the capital of Canada?',
    status: 'unknown',
    acceptableIds: [[]],
    expectedMode: 'local',
  },
];
// Questions only the local model answers, in both languages. The gate needs a
// correct local answer for each of them.
const MODEL_SENTINELS: Fixture[] = [
  {
    suite: 'sentinel',
    locale: 'en',
    question: 'How does SpotifyTracker recover missed plays?',
    status: 'answer',
    acceptableIds: [['spotify-recovery']],
    expectedMode: 'local',
  },
  {
    suite: 'sentinel',
    locale: 'de',
    question: 'Wie trägt SpotifyTracker verpasste Wiedergaben nach?',
    status: 'answer',
    acceptableIds: [['spotify-recovery']],
    expectedMode: 'local',
  },
];
const RECOVERY_TIMEOUT_MS = 120_000;
/** Spacing that keeps recovery polling inside the normal gateway quota. */
const RECOVERY_POLL_MS = 12_000;
const COMPOSE_FILE = 'deploy/docker-compose.ask.yml';
const COMPOSE_SERVICES = ['website', 'ask', 'ollama'];
/** Longer than the gateway's own warm-up timeout. */
const WARMUP_WAIT_MS = 150_000;
const httpFlag = process.argv.indexOf('--http');
const httpUrl = httpFlag < 0 ? undefined : process.argv[httpFlag + 1];
if (httpFlag >= 0 && (!httpUrl || httpUrl.startsWith('--')))
  throw new Error('--http requires a base URL');
const httpOrigin = httpUrl ? new URL(httpUrl).origin : undefined;
const resetProjectFlag = process.argv.indexOf('--reset-compose-project');
const resetProject =
  resetProjectFlag < 0 ? undefined : process.argv[resetProjectFlag + 1];
const COMPOSE_PROJECT_PATTERN = /^[a-z0-9][a-z0-9_-]{0,62}$/i;
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);
if (resetProjectFlag >= 0) {
  if (
    !resetProject ||
    resetProject.startsWith('--') ||
    !COMPOSE_PROJECT_PATTERN.test(resetProject)
  )
    throw new Error(
      '--reset-compose-project requires a valid Compose project name',
    );
  if (!httpOrigin || !LOOPBACK_HOSTS.has(new URL(httpOrigin).hostname))
    throw new Error(
      '--reset-compose-project is limited to loopback --http URLs',
    );
}
const coldOnly = process.argv.includes('--cold-only');
const warmOnly = process.argv.includes('--warm-only');
const suiteOnly = process.argv.includes('--suite-only');
if ([coldOnly, warmOnly, suiteOnly].filter(Boolean).length > 1)
  throw new Error('Choose one of --cold-only, --warm-only, or --suite-only');
if ((coldOnly || warmOnly || suiteOnly) && !httpOrigin)
  throw new Error('The packaged check options require --http');
const gate = process.argv.includes('--gate');
const recovery = process.argv.includes('--recovery');
// Recovery runs alone so earlier requests do not use up its quota.
if (recovery && (gate || coldOnly || warmOnly || suiteOnly))
  throw new Error('--recovery runs on its own');
const checkCold = !warmOnly && !suiteOnly && !recovery;
if ((gate || recovery) && !httpOrigin)
  throw new Error('--gate and --recovery require --http');
if (recovery && !resetProject)
  throw new Error('--recovery pauses Ollama and needs --reset-compose-project');
const mode = httpOrigin
  ? 'http'
  : process.argv.includes('--index')
    ? 'index'
    : process.argv.includes('--lexical')
      ? 'lexical'
      : 'gateway';
const usesHttp = mode === 'http' || mode === 'gateway';
const baseline = process.argv.includes('--baseline');
const expectationsVersion = baseline ? 'baseline-v1' : 'approved-v2';
const reportFlag = process.argv.indexOf('--report');
const reportPath = reportFlag < 0 ? undefined : process.argv[reportFlag + 1];
if (reportFlag >= 0 && (!reportPath || reportPath.startsWith('--')))
  throw new Error('--report requires a file path');
if (mode === 'gateway' && !graniteLocal)
  throw new Error(
    'Set ASK_GRANITE=local to exercise the native gateway and Granite fallback',
  );

const rankPortFlag = process.argv.indexOf('--rank-port');
const rankPort =
  rankPortFlag === -1 ? undefined : Number(process.argv[rankPortFlag + 1]);
const MAX_PORT = 65_535;
if (
  rankPort !== undefined &&
  (!Number.isInteger(rankPort) || rankPort < 1 || rankPort > MAX_PORT)
)
  throw new Error('--rank-port requires a valid TCP port');
const rankWithGranite = graniteRanker(rankPort);
let coldProbe: {
  httpStatus: number | null;
  status: string;
  mode: string | null;
  ids: string[];
  citations: AskResult['sources'];
  ms: number;
  error?: string;
} | null = null;

type Fixture = {
  suite: string;
  locale: string;
  question: string;
  status: string;
  acceptableIds: string[][];
  expectedMode?: AskResult['mode'];
  id?: string;
  family?: string;
  category?: string;
  history?: HistoryEntry[];
  /** True when approved-answers.json replaced the fixture's own expectation. */
  expectationOverlay?: boolean;
};
const basicFixtures = (
  suite: string,
  entries: readonly {
    locale: string;
    question: string;
    status: string;
    id?: string;
  }[],
): Fixture[] =>
  entries.map(({ id, ...fixture }) => ({
    ...fixture,
    suite,
    acceptableIds: [id ? [id] : []],
  }));
const original = basicFixtures('original', questions);
const extra = basicFixtures('paraphrases', paraphrases);
const suite = [
  ...original,
  ...extra,
  ...heldOut.map((fixture) => ({ ...fixture, suite: 'held-out' })),
];
const misses = new Set([
  'Was verhindert in SpotifyTracker nach einer langen Pause doppelte Wiedergaben?',
  'Which parts of SpotifyTracker did Timo rebuild, and what technology did he use?',
  'Which methods can the thesis tool use to analyse a schedule?',
]);
// --questions <file> runs a reviewed question-set file (e.g. the development
// or final held-out set) instead of the built-in suites.
const questionsFlag = process.argv.indexOf('--questions');
const questionsFile =
  questionsFlag >= 0 ? process.argv[questionsFlag + 1] : undefined;
if (questionsFlag >= 0 && (!questionsFile || questionsFile.startsWith('--')))
  throw new Error('--questions requires a question-set file');
const baselineFixtures: Fixture[] = questionsFile
  ? parseQuestionSet(
      JSON.parse(readFileSync(questionsFile, 'utf8')),
      basename(questionsFile, extname(questionsFile)),
    )
  : process.argv.includes('--routing')
    ? basicFixtures('routing', routing)
    : process.argv.includes('--misses')
      ? suite.filter(({ question }) => misses.has(question))
      : process.argv.includes('--paraphrases')
        ? extra
        : process.argv.includes('--original')
          ? original
          : suite;
const allFixtures = process.argv.includes('--answers')
  ? basicFixtures('approved-answers', approvedAnswers)
  : baselineFixtures.map((fixture) => {
      const update = baseline
        ? undefined
        : approvedExpectation(fixture.suite, fixture);
      return update
        ? {
            ...fixture,
            status: update.status,
            acceptableIds: [update.id ? [update.id] : []],
            expectationOverlay: true,
          }
        : fixture;
    });
const routingExpectations = allFixtures.filter(
  ({ suite }) => suite === 'routing',
);
if (routingExpectations.length && !baseline) {
  assertRoutingExpectations(routingExpectations);
}
const fixtures =
  mode === 'http'
    ? coldOnly || recovery
      ? []
      : gate
        ? [...PACKAGED_WARM_FIXTURES, ...MODEL_SENTINELS]
        : warmOnly
          ? PACKAGED_WARM_FIXTURES
          : allFixtures
    : allFixtures;
if (process.argv.includes('--misses') && mode !== 'http')
  assert.equal(fixtures.length, misses.size);

const compose = (...args: string[]) =>
  execFileAsync('docker', [
    'compose',
    '-p',
    resetProject!,
    '-f',
    COMPOSE_FILE,
    ...args,
  ]);
const output = async (command: Promise<{ stdout: string }>) =>
  (await command.catch(() => ({ stdout: '' }))).stdout.trim();

if (mode === 'http') {
  const deadline = Date.now() + HTTP_STARTUP_TIMEOUT_MS;
  for (;;) {
    const ready = await fetch(new URL('/api/ask', httpOrigin!), {
      signal: AbortSignal.timeout(2_000),
    }).catch(() => undefined);
    if (ready?.status === 405) break;
    assert.ok(Date.now() < deadline, 'Ask gateway did not start through nginx');
    await delay(HTTP_POLL_INTERVAL_MS);
  }
  // With ASK_WARMUP=on the gateway answers 503 until its warm-up ends, so
  // the cold probe is the first visitor request after a fresh start.
  if (checkCold && resetProject) await waitForWarmGateway();
  if (checkCold) {
    const coldStart = performance.now();
    try {
      const response = await fetch(new URL('/api/ask', httpOrigin), {
        method: 'POST',
        headers: {
          Origin: httpOrigin!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: PACKAGED_COLD_QUESTION,
          locale: 'en',
        }),
        signal: AbortSignal.timeout(CLIENT_TIMEOUT),
      });
      const body: unknown = await response.json().catch(() => null);
      const result = validateResult(body, 'en', corpusVersion);
      coldProbe = {
        httpStatus: response.status,
        status: result?.status ?? 'outage',
        mode: result?.mode ?? null,
        ids: result?.claims.map(({ id }) => id) ?? [],
        citations: result?.sources ?? [],
        ms: Math.round(performance.now() - coldStart),
      };
      console.log('cold probe', JSON.stringify(coldProbe));
    } catch (error) {
      coldProbe = {
        httpStatus: null,
        status: 'outage',
        mode: null,
        ids: [],
        citations: [],
        ms: Math.round(performance.now() - coldStart),
        error: error instanceof Error ? error.message : String(error),
      };
      console.log('cold probe', JSON.stringify(coldProbe));
    }
  }
}

let resetTargetVerified = false;
/** Refuses to touch a Compose project that does not serve the tested URL. */
async function verifyResetTarget() {
  if (resetTargetVerified || !resetProject) return;
  const published = await output(compose('port', 'website', '80'));
  const services = (await output(compose('config', '--services'))).split(/\s+/);
  assert.ok(
    publishedPortMatches(published, httpOrigin!) &&
      COMPOSE_SERVICES.every((service) => services.includes(service)),
    `Compose project ${resetProject} does not publish ${httpOrigin}; refusing to restart it`,
  );
  resetTargetVerified = true;
}

/** Build, model and resource identity recorded with every HTTP report. */
async function hostIdentity() {
  const run = (command: string, args: string[]) =>
    output(execFileAsync(command, args));
  const identity: Record<string, unknown> = {
    commit: await run('git', ['rev-parse', 'HEAD']),
    worktreeClean: !(await run('git', ['status', '--porcelain'])),
    model: MODEL,
    modelDigest: MODEL_DIGEST,
    contextTokens: SELECTOR_CONTEXT_TOKENS,
    budgets: MODEL_GATE,
    warmMethod:
      (checkCold
        ? 'cold probe first, then the cases on the loaded model'
        : 'cases on the current model state, no cold probe') +
      (resetProject ? '; after each restart, wait for gateway warm-up' : ''),
    gatewayResets: resetProject
      ? `restart ask every ${PACKAGED_RETRIEVAL_QUOTA} requests`
      : 'none',
  };
  if (resetProject) {
    identity.composeProject = resetProject;
    identity.images = await output(compose('images', '--format', 'json'));
    identity.askEnvironment = (
      await output(compose('exec', '-T', 'ask', 'printenv'))
    )
      .split('\n')
      .filter((line) => line.startsWith('ASK_'));
    identity.docker = await run('docker', [
      'info',
      '--format',
      'cpus={{.NCPU}} memory={{.MemTotal}}',
    ]);
  } else {
    identity.ollamaThreads = ollamaThreads(process.env);
  }
  return identity;
}

/**
 * HTTP readiness is not warm inference: with ASK_WARMUP=on the gateway
 * answers 503 until its warm-up ends, so wait for the log line.
 */
async function waitForWarmGateway() {
  const warmup = await output(
    compose('exec', '-T', 'ask', 'printenv', 'ASK_WARMUP'),
  );
  if (warmup !== 'on') return;
  const deadline = Date.now() + WARMUP_WAIT_MS;
  for (;;) {
    const state = warmupState(
      await output(compose('logs', '--no-log-prefix', 'ask')),
    );
    assert.notEqual(state, 'failed', 'Ask gateway warm-up failed');
    if (state === 'ready') return;
    assert.ok(Date.now() < deadline, 'Ask gateway warm-up did not finish');
    await delay(HTTP_POLL_INTERVAL_MS);
  }
}

async function resetPackagedGateway() {
  if (!resetProject) return;
  await verifyResetTarget();
  await compose('restart', 'ask');
  const deadline = Date.now() + HTTP_STARTUP_TIMEOUT_MS;
  for (;;) {
    const ready = await fetch(new URL('/api/ask', httpOrigin!), {
      signal: AbortSignal.timeout(2_000),
    }).catch(() => undefined);
    if (ready?.status === 405) return waitForWarmGateway();
    assert.ok(
      Date.now() < deadline,
      'Ask gateway did not restart through nginx',
    );
    await delay(HTTP_POLL_INTERVAL_MS);
  }
}

if (mode !== 'index' && mode !== 'http') {
  const question = 'Where did Timo use Python and Flask?';
  const { candidates } = prepareQuestion(question, 'en');
  const primed = await askModel(
    selectWithOllama,
    question,
    'en',
    candidates,
    AbortSignal.timeout(PRIME_TIMEOUT_MS),
  );
  assert.ok(
    primed?.claims.some(({ id }) => id === 'spotify-python'),
    'could not prime the pinned selector',
  );
}

async function runGateway(
  question: string,
  locale: Locale,
  history: ReturnType<typeof historyTurns>,
) {
  let graniteRan = false;
  let qwenEvidenceIds: string[] = [];
  let selectorCalls = 0;
  const server = createGateway({
    rank: (...args) => {
      graniteRan = true;
      return rankWithGranite(...args);
    },
    select: (...args) => {
      selectorCalls += 1;
      qwenEvidenceIds = args[2].map(({ id }) => id);
      return selectWithOllama(...args);
    },
  });
  // Each fixture gets a new gateway quota while sharing the warm model and
  // native ranker. The request still goes through the production HTTP handler.
  server.listen(0, LOOPBACK);
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  const host = LOOPBACK + ':' + localPorts[locale];
  const body = JSON.stringify({
    question,
    locale,
    ...(history.length ? { history } : {}),
  });
  const start = performance.now();
  try {
    const response = await new Promise<{ status: number; body: unknown }>(
      (resolve, reject) => {
        const req = request(
          {
            host: LOOPBACK,
            port,
            path: '/api/ask',
            method: 'POST',
            agent: false,
            signal: AbortSignal.timeout(CLIENT_TIMEOUT),
            headers: {
              Host: host,
              Origin: 'http://' + host,
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(body),
            },
          },
          async (reply) => {
            try {
              reply.setEncoding('utf8');
              let text = '';
              for await (const chunk of reply) text += chunk;
              resolve({
                status: reply.statusCode ?? 0,
                body: JSON.parse(text),
              });
            } catch (error) {
              reject(error);
            }
          },
        );
        req.on('error', reject);
        req.end(body);
      },
    );
    return {
      ...response,
      graniteRan,
      qwenEvidenceIds,
      selectorCalls,
      ms: performance.now() - start,
    };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

const rows = [];
let packagedRequestsSinceReset = 0;
if (mode === 'http' && resetProject && fixtures.length) {
  await resetPackagedGateway();
}
for (const fixture of fixtures) {
  const { question } = fixture;
  const locale = fixture.locale === 'de' ? 'de' : 'en';
  const history = historyTurns(fixture.history, locale);
  const { fallback, candidates, semanticPool, compound } = prepareQuestion(
    question,
    locale,
    history,
  );
  const lexicalCandidates = candidates.map(({ id }) => id);
  let actual: AskResult | null = fallback;
  let httpStatus: number | null = null;
  let graniteRan = false;
  let qwenEvidenceIds: string[] = [];
  // Selector calls and their raw model replies; unknown over HTTP, where the
  // gateway runs in another process.
  let selectorCalls: number | null = mode === 'http' ? null : 0;
  const modelCalls: OllamaCall[] = [];
  setOllamaCallListener(
    mode === 'http' ? undefined : (call) => modelCalls.push(call),
  );
  const start = performance.now();
  let ms;
  if (mode === 'http') {
    if (
      resetProject &&
      packagedRequestsSinceReset >= PACKAGED_RETRIEVAL_QUOTA
    ) {
      await resetPackagedGateway();
      packagedRequestsSinceReset = 0;
    }
    if (resetProject) packagedRequestsSinceReset += 1;
    const started = performance.now();
    try {
      const response = await fetch(new URL('/api/ask', httpOrigin!), {
        method: 'POST',
        headers: {
          Origin: httpOrigin!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question,
          locale,
          ...(history.length ? { history } : {}),
        }),
        signal: AbortSignal.timeout(CLIENT_TIMEOUT),
      });
      httpStatus = response.status;
      const body: unknown = await response.json().catch(() => null);
      actual =
        httpStatus === 200 ? validateResult(body, locale, corpusVersion) : null;
      ms = performance.now() - started;
    } catch {
      httpStatus = null;
      actual = null;
      ms = performance.now() - started;
    }
  } else if (mode === 'gateway') {
    const response = await runGateway(question, locale, history);
    httpStatus = response.status;
    ms = response.ms;
    graniteRan = response.graniteRan;
    qwenEvidenceIds = response.qwenEvidenceIds;
    selectorCalls = response.selectorCalls;
    actual =
      httpStatus === 200
        ? validateResult(response.body, locale, corpusVersion)
        : null;
    if (httpStatus === 200) assert.ok(actual, 'invalid gateway body');
  } else {
    if (mode === 'lexical' && candidates.length) {
      qwenEvidenceIds = lexicalCandidates;
      selectorCalls = 1;
      actual = await askModel(
        selectWithOllama,
        question,
        locale,
        candidates,
        AbortSignal.timeout(LEXICAL_TIMEOUT_MS),
        history,
        compound,
      ).catch(() => null);
    }
    ms = performance.now() - start;
  }
  if (actual) assert.ok(validateResult(actual, locale, corpusVersion));
  const ids = actual?.claims.map(({ id }) => id) ?? [];
  const matchingIds = fixture.acceptableIds.find(
    (expected) =>
      expected.length === ids.length &&
      expected.every((id) => ids.includes(id)),
  );
  const match =
    (mode !== 'http' || httpStatus === 200) &&
    actual?.status === fixture.status &&
    (!fixture.expectedMode || actual?.mode === fixture.expectedMode) &&
    Boolean(matchingIds);
  const route = graniteRan
    ? 'granite'
    : mode === 'http'
      ? actual?.mode === 'local'
        ? 'http-local'
        : actual
          ? 'http-index'
          : 'http-outage'
      : qwenEvidenceIds.length
        ? 'lexical'
        : fallback.status === 'unknown'
          ? mode === 'index' &&
            (lexicalCandidates.length || semanticPool.length)
            ? 'index-only'
            : 'no-evidence'
          : 'direct';
  setOllamaCallListener(undefined);
  rows.push({
    suite: fixture.suite,
    ...(fixture.id ? { id: fixture.id } : {}),
    ...(fixture.family ? { family: fixture.family } : {}),
    ...(fixture.category ? { category: fixture.category } : {}),
    locale,
    question,
    ...(fixture.history ? { history: fixture.history } : {}),
    expectationOverlay: Boolean(fixture.expectationOverlay),
    selectorCalls,
    modelCalls,
    expectedStatus: fixture.status,
    expectedMode: fixture.expectedMode,
    expectedIds: fixture.acceptableIds,
    lexicalCandidates,
    semanticPool,
    graniteRan,
    qwenEvidenceIds,
    route,
    httpStatus,
    status: actual?.status ?? 'error',
    resultMode: actual?.mode ?? null,
    ids,
    citations: actual?.sources ?? [],
    expectedCitationIds: [
      ...new Set(
        (matchingIds ?? fixture.acceptableIds[0])
          .map((id) => facts.find((fact) => fact.id === id)?.sourceId)
          .filter((id): id is string => Boolean(id)),
      ),
    ],
    match,
    ms: Math.round(ms),
  });
}

const summary = [...new Set(rows.map(({ route }) => route))].map((route) => {
  const group = rows.filter((row) => row.route === route);
  const times = group
    .filter(({ qwenEvidenceIds, resultMode, status }) =>
      mode === 'http'
        ? resultMode === 'local' && status !== 'error'
        : qwenEvidenceIds.length > 0 && status !== 'error',
    )
    .map(({ ms }) => ms)
    .sort((a, b) => a - b);
  return {
    route,
    total: group.length,
    passed: group.filter(({ match }) => match).length,
    errors: group.filter(({ status }) => status === 'error').length,
    outages: usesHttp
      ? group.filter(
          ({ httpStatus }) => httpStatus === null || httpStatus !== 200,
        ).length
      : null,
    p95Ms: times.length
      ? times[Math.ceil(times.length * WARM_PERCENTILE) - 1]
      : null,
  };
});
console.log(
  mode,
  expectationsVersion,
  corpusVersion,
  rows.filter(({ match }) => match).length + '/' + rows.length,
);
console.table(summary);
if (process.argv.includes('--misses')) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  console.table(
    rows
      .filter(({ match }) => !match)
      .map(({ route, question, expectedStatus, expectedIds, status, ids }) => ({
        route,
        question,
        expected: [
          expectedStatus,
          expectedIds.map((set) => set.join('+')).join(' or '),
        ].join(' '),
        actual: [status, ...ids].join(' '),
      })),
  );
}
async function askOnce(question: string): Promise<RecoverySample> {
  const started = performance.now();
  const response = await fetch(new URL('/api/ask', httpOrigin!), {
    method: 'POST',
    headers: { Origin: httpOrigin!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, locale: 'en' }),
    signal: AbortSignal.timeout(CLIENT_TIMEOUT),
  }).catch(() => undefined);
  const body: unknown = await response?.json().catch(() => null);
  const result =
    response?.status === 200 ? validateResult(body, 'en', corpusVersion) : null;
  return {
    httpStatus: response?.status ?? null,
    mode: result?.mode ?? null,
    ms: Math.round(performance.now() - started),
  };
}

// Loss and recovery on one gateway process with its normal quota: Ollama is
// paused and resumed, the gateway is never restarted.
let recoveryReport: Record<string, unknown> | null = null;
if (recovery) {
  await verifyResetTarget();
  await waitForWarmGateway();
  const before = await askOnce(PACKAGED_COLD_QUESTION);
  await compose('pause', 'ollama');
  let duringOutage: RecoverySample;
  try {
    duringOutage = await askOnce(PACKAGED_COLD_QUESTION);
  } finally {
    await compose('unpause', 'ollama');
  }
  const resumed = performance.now();
  const afterResume: RecoverySample[] = [];
  while (performance.now() - resumed < RECOVERY_TIMEOUT_MS) {
    await delay(RECOVERY_POLL_MS);
    const sample = await askOnce(PACKAGED_COLD_QUESTION);
    afterResume.push({
      ...sample,
      at: Math.round(performance.now() - resumed),
    });
    if (sample.httpStatus === 200 && sample.mode === 'local') break;
  }
  recoveryReport = {
    before,
    duringOutage,
    afterResume,
    ...recoveryOutcome({ duringOutage, afterResume }),
  };
  console.log('recovery', JSON.stringify(recoveryReport));
}

const gateResult = gate ? modelGate(rows, checkCold ? coldProbe : null) : null;
if (gateResult) {
  console.log(gateResult.passed ? 'model gate passed' : 'model gate FAILED');
  for (const failure of gateResult.failures) console.log(' - ' + failure);
  console.table(gateResult.counts);
}
const identity = usesHttp ? await hostIdentity() : null;

if (reportPath)
  await writeFile(
    reportPath,
    JSON.stringify(
      {
        mode,
        usesHttp,
        expectationsVersion,
        corpusVersion,
        identity,
        coldProbe,
        gate: gateResult,
        recovery: recoveryReport,
        summary,
        rows,
      },
      null,
      2,
    ) + '\n',
  );
if (mode === 'gateway' && rows.some(({ match }) => !match))
  process.exitCode = 1;
if (
  mode === 'http' &&
  (rows.some(({ match }) => !match) ||
    (checkCold &&
      (!coldProbe ||
        coldProbe.httpStatus !== 200 ||
        coldProbe.status !== 'answer' ||
        coldProbe.mode !== 'local' ||
        coldProbe.ids.join() !== 'spotify-python' ||
        coldProbe.citations.map(({ id }) => id).join() !== 'spotify-code')))
)
  process.exitCode = 1;
if (gateResult && !gateResult.passed) process.exitCode = 1;
if (recoveryReport && !recoveryReport.recovered) process.exitCode = 1;
