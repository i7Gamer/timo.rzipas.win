import assert from 'node:assert/strict';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { writeFile } from 'node:fs/promises';
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
import { selectWithOllama } from '../../services/ask/ollama.ts';
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

const LEXICAL_TIMEOUT_MS = 6_000;
const PRIME_TIMEOUT_MS = 45_000;
const WARM_PERCENTILE = 0.95;
const HTTP_STARTUP_TIMEOUT_MS = 30_000;
const HTTP_POLL_INTERVAL_MS = 500;
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
const httpFlag = process.argv.indexOf('--http');
const httpUrl = httpFlag < 0 ? undefined : process.argv[httpFlag + 1];
if (httpFlag >= 0 && (!httpUrl || httpUrl.startsWith('--')))
  throw new Error('--http requires a base URL');
const httpOrigin = httpUrl ? new URL(httpUrl).origin : undefined;
const coldOnly = process.argv.includes('--cold-only');
const warmOnly = process.argv.includes('--warm-only');
if (coldOnly && warmOnly)
  throw new Error('--cold-only and --warm-only cannot be combined');
if ((coldOnly || warmOnly) && !httpOrigin)
  throw new Error('--cold-only and --warm-only require --http');
const mode = httpOrigin
  ? 'http'
  : process.argv.includes('--index')
    ? 'index'
    : process.argv.includes('--lexical')
      ? 'lexical'
      : 'gateway';
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
const baselineFixtures = process.argv.includes('--routing')
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
      const update = process.argv.includes('--baseline')
        ? undefined
        : approvedExpectation(fixture.suite, fixture);
      return update
        ? {
            ...fixture,
            status: update.status,
            acceptableIds: [update.id ? [update.id] : []],
          }
        : fixture;
    });
const fixtures =
  mode === 'http'
    ? warmOnly
      ? PACKAGED_WARM_FIXTURES
      : coldOnly
        ? []
        : PACKAGED_WARM_FIXTURES
    : allFixtures;
if (process.argv.includes('--misses') && mode !== 'http')
  assert.equal(fixtures.length, misses.size);

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
  if (!warmOnly) {
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

async function runGateway(question: string, locale: Locale) {
  let graniteRan = false;
  let qwenEvidenceIds: string[] = [];
  const server = createGateway({
    rank: (...args) => {
      graniteRan = true;
      return rankWithGranite(...args);
    },
    select: (...args) => {
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
  const body = JSON.stringify({ question, locale });
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
      ms: performance.now() - start,
    };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

const rows = [];
for (const fixture of fixtures) {
  const { question } = fixture;
  const locale = fixture.locale === 'de' ? 'de' : 'en';
  const { fallback, candidates, semanticPool } = prepareQuestion(
    question,
    locale,
  );
  const lexicalCandidates = candidates.map(({ id }) => id);
  let actual: AskResult | null = fallback;
  let httpStatus: number | null = null;
  let graniteRan = false;
  let qwenEvidenceIds: string[] = [];
  const start = performance.now();
  let ms;
  if (mode === 'http') {
    const started = performance.now();
    try {
      const response = await fetch(new URL('/api/ask', httpOrigin!), {
        method: 'POST',
        headers: {
          Origin: httpOrigin!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question, locale }),
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
    const response = await runGateway(question, locale);
    httpStatus = response.status;
    ms = response.ms;
    graniteRan = response.graniteRan;
    qwenEvidenceIds = response.qwenEvidenceIds;
    actual =
      httpStatus === 200
        ? validateResult(response.body, locale, corpusVersion)
        : null;
    if (httpStatus === 200) assert.ok(actual, 'invalid gateway body');
  } else {
    if (mode === 'lexical' && candidates.length) {
      qwenEvidenceIds = lexicalCandidates;
      actual = await askModel(
        selectWithOllama,
        question,
        locale,
        candidates,
        AbortSignal.timeout(LEXICAL_TIMEOUT_MS),
      ).catch(() => null);
    }
    ms = performance.now() - start;
  }
  if (actual) assert.ok(validateResult(actual, locale, corpusVersion));
  const ids = actual?.claims.map(({ id }) => id) ?? [];
  const match =
    (mode !== 'http' || httpStatus === 200) &&
    actual?.status === fixture.status &&
    (!fixture.expectedMode || actual?.mode === fixture.expectedMode) &&
    fixture.acceptableIds.some(
      (expected) =>
        expected.length === ids.length &&
        expected.every((id) => ids.includes(id)),
    ) &&
    (mode !== 'http' ||
      actual?.sources.map(({ id }) => id).join() ===
        fixture.acceptableIds[0]
          .map((id) => facts.find((fact) => fact.id === id)?.sourceId)
          .filter(Boolean)
          .filter((id, index, all) => all.indexOf(id) === index)
          .join());
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
  rows.push({
    suite: fixture.suite,
    locale,
    question,
    expectedStatus: fixture.status,
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
    expectedCitationIds: fixture.acceptableIds[0]
      .map((id) => facts.find((fact) => fact.id === id)?.sourceId)
      .filter((id): id is string => Boolean(id)),
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
    outages: group.filter(
      ({ httpStatus }) => httpStatus === null || httpStatus !== 200,
    ).length,
    p95Ms: times.length
      ? times[Math.ceil(times.length * WARM_PERCENTILE) - 1]
      : null,
  };
});
console.log(
  mode,
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
if (reportPath)
  await writeFile(
    reportPath,
    JSON.stringify({ mode, corpusVersion, coldProbe, summary, rows }, null, 2) +
      '\n',
  );
if (mode === 'gateway' && rows.some(({ match }) => !match))
  process.exitCode = 1;
if (
  mode === 'http' &&
  (rows.some(({ match }) => !match) ||
    (!warmOnly &&
      (!coldProbe ||
        coldProbe.httpStatus !== 200 ||
        coldProbe.status !== 'answer' ||
        coldProbe.mode !== 'local' ||
        coldProbe.ids.join() !== 'spotify-python' ||
        coldProbe.citations.map(({ id }) => id).join() !== 'spotify-code')))
)
  process.exitCode = 1;
