import { readFile } from 'node:fs/promises';
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import {
  MAX_QUESTION,
  sourceLink,
  summaryRequiresAllFacts,
  type AskResult,
} from '../../src/lib/ask/catalog.ts';
import { isChatHistory } from '../../src/lib/ask/history.ts';
import {
  LOCAL_PETS_PATH,
  parseLocalPets,
  type LocalPets,
} from '../../src/lib/ask/local-pets.ts';
import {
  rankedCandidates,
  rankWithGranite,
  type RankFacts,
} from './granite.ts';
import { graniteLocal, localPorts, LOOPBACK } from './local-profile.ts';
import {
  selectWithOllama,
  summarizeWithOllama,
  warmSelector,
  WARMUP_TIMEOUT_MS,
  type SummarizeFacts,
} from './ollama.ts';
import {
  askModel,
  broadEvidencePool,
  poolCandidates,
  prepareBoundedQuestion,
  prepareQuestion,
  rankedWithTopics,
  type SelectFacts,
} from './selection.ts';
import { isTopicCandidate } from '../../src/lib/ask/topics.ts';

const LOCAL_ORIGINS = [localPorts.en, localPorts.de].map(
  (port) => `http://${LOOPBACK}:${port}`,
);
const MAX_BYTES = 8 * 1024;
const MINUTE = 60_000;
const UPSTREAM_TIMEOUT = 6_000;
const SUMMARY_TIMEOUT = 8_000;
const EXPERIMENTAL_SELECTOR_TIMEOUT_MS = 8_000;
const SELECTOR_SETTLE_MS = 350;
const SETTLE_DEADLINE_DIVISOR = 4;
const INFERENCE_LIMIT = 60;

function reviewedSummary(
  fallback: AskResult,
  selection: unknown,
): AskResult | null {
  if (
    !selection ||
    typeof selection !== 'object' ||
    Object.keys(selection).length !== 1 ||
    !('ids' in selection) ||
    !Array.isArray(selection.ids)
  )
    return null;
  const ids: unknown[] = selection.ids;
  if (
    !ids.length ||
    ids.length > fallback.claims.length ||
    (summaryRequiresAllFacts(fallback.claims) &&
      ids.length !== fallback.claims.length) ||
    new Set(ids).size !== ids.length
  )
    return null;
  const claims = [];
  for (const id of ids) {
    const claim = fallback.claims.find((candidate) => candidate.id === id);
    if (!claim) return null;
    claims.push(claim);
  }
  const sources = [...new Set(claims.map(({ sourceId }) => sourceId))].map(
    (sourceId) => sourceLink(sourceId, fallback.locale),
  );
  if (sources.length !== fallback.sources.length) return null;
  return { ...fallback, mode: 'local', claims, sources };
}

function quota(limit: number, window: number) {
  const entries: number[] = [];
  return () => {
    const now = Date.now();
    while (entries.length && entries[0] + window <= now) entries.shift();
    if (entries.length >= limit)
      return Math.ceil((entries[0] + window - now) / 1000);
    entries.push(now);
    return 0;
  };
}

function reply(response: ServerResponse, status: number, payload: object) {
  if (response.destroyed) return;
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(payload));
}

function fail(response: ServerResponse, status: number, retryAfter = 0) {
  if (response.destroyed) return;
  if (retryAfter) response.setHeader('Retry-After', retryAfter);
  if (status === 405) response.setHeader('Allow', 'POST');
  if (status === 413) response.setHeader('Connection', 'close');
  reply(response, status, { error: status });
}

async function readQuestion(request: IncomingMessage) {
  if (Number(request.headers['content-length']) > MAX_BYTES) throw 413;
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > MAX_BYTES) throw 413;
    chunks.push(chunk);
  }
  const value: unknown = JSON.parse(
    new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)),
  );
  if (
    !value ||
    typeof value !== 'object' ||
    Object.keys(value).some(
      (key) => !['question', 'locale', 'history'].includes(key),
    )
  )
    throw 400;
  const { question, locale, history } = value as {
    question?: unknown;
    locale?: unknown;
    history?: unknown;
  };
  if (typeof question !== 'string' || (locale !== 'en' && locale !== 'de'))
    throw 400;
  if (history !== undefined && !isChatHistory(history)) throw 400;
  const trimmed = question.trim();
  if (!trimmed || [...trimmed].length > MAX_QUESTION || !trimmed.isWellFormed())
    throw 400;
  return { question: trimmed, locale, history } as const;
}

export function createGateway({
  select = selectWithOllama,
  summarize = process.env.ASK_SUMMARIES === 'on'
    ? summarizeWithOllama
    : undefined,
  rank,
  timeout,
  selectorTimeout = UPSTREAM_TIMEOUT,
  local = true,
  origins = LOCAL_ORIGINS,
  privatePets,
  warmup,
}: {
  select?: SelectFacts;
  summarize?: SummarizeFacts;
  rank?: RankFacts;
  timeout?: number;
  selectorTimeout?: number;
  local?: boolean;
  origins?: readonly string[];
  privatePets?: LocalPets;
  warmup?: (signal: AbortSignal) => Promise<void>;
} = {}) {
  const siteOrigins = new Map(
    origins.map((origin) => {
      const site = new URL(origin);
      if (
        !['http:', 'https:'].includes(site.protocol) ||
        site.origin !== origin
      ) {
        throw new Error('Expected an exact HTTP or HTTPS site origin');
      }
      return [site.host, origin];
    }),
  );
  // Every request comes through the preview or container proxy. Forwarded
  // identities cannot split the quota or grow a table of client identifiers.
  const checkRequestQuota = quota(6, MINUTE);
  const checkRetrievalQuota = quota(4, MINUTE);
  const checkModelQuota = quota(INFERENCE_LIMIT, 60 * MINUTE);
  const checkSummaryQuota = quota(INFERENCE_LIMIT, 60 * MINUTE);
  let running = false;
  let retryAt = 0;
  let settleUntil = 0;
  let failures = 0;

  const server = createServer(
    {
      headersTimeout: 5_000,
      requestTimeout: 5_000,
      connectionsCheckingInterval: 1_000,
    },
    async (request, response) => {
      const asksLocalPets = request.url === LOCAL_PETS_PATH;
      if (request.url !== '/api/ask' && (!asksLocalPets || !privatePets))
        return fail(response, 404);
      if (request.method !== 'POST') return fail(response, 405);
      const origin = siteOrigins.get(request.headers.host ?? '');
      if (!origin || request.headers.origin !== origin) {
        return fail(response, 403);
      }
      if (
        request.headers['content-type']
          ?.split(';', 1)[0]
          .trim()
          .toLowerCase() !== 'application/json'
      ) {
        return fail(response, 415);
      }
      if (asksLocalPets && privatePets) {
        if (!LOCAL_ORIGINS.includes(origin)) return fail(response, 403);
        return reply(response, 200, privatePets);
      }
      const requestWait = checkRequestQuota();

      let input;
      try {
        input = await readQuestion(request);
      } catch (error) {
        return fail(response, error === 413 ? 413 : 400);
      }
      if (response.destroyed) return;
      const { question, locale, history } = input;
      const bounded = prepareBoundedQuestion(question, locale, history);
      let prepared: ReturnType<typeof prepareQuestion> = bounded;
      const unavailable = (status: number, wait?: number) =>
        prepared.fallback.status === 'unknown'
          ? fail(response, status, wait)
          : reply(response, 200, prepared.fallback);
      if (requestWait) return unavailable(429, requestWait);
      if (
        !local ||
        (bounded.summary && !summarize) ||
        (!bounded.retrievalRequired &&
          !bounded.summary &&
          bounded.fallback.status !== 'unknown' &&
          !bounded.candidates.length)
      ) {
        return reply(response, 200, bounded.fallback);
      }
      if (bounded.retrievalRequired) {
        const retrievalWait = checkRetrievalQuota();
        if (retrievalWait) return unavailable(429, retrievalWait);
        prepared = prepareQuestion(question, locale, history);
      }
      const { fallback, candidates, semanticPool, allowBroadSearch } = prepared;
      if (running || (!prepared.summary && Date.now() < retryAt)) {
        return unavailable(503);
      }
      const modelWait = prepared.summary
        ? checkSummaryQuota()
        : checkModelQuota();
      if (modelWait) return unavailable(429, modelWait);

      running = true;
      const disconnect = new AbortController();
      const onClose = () => disconnect.abort();
      response.once('close', onClose);
      const modelTimeout =
        timeout ?? (prepared.summary ? SUMMARY_TIMEOUT : selectorTimeout);
      const signal = AbortSignal.any([
        disconnect.signal,
        AbortSignal.timeout(modelTimeout),
      ]);
      const inferenceStarted = performance.now();
      try {
        if (
          prepared.summary &&
          summarize &&
          fallback.status === 'answer' &&
          fallback.claims.length
        ) {
          const summary = reviewedSummary(
            fallback,
            await summarize(locale, fallback.claims, signal),
          );
          if (!summary || signal.aborted)
            throw new Error('Invalid summary result');
          return reply(response, 200, summary);
        }
        const settleTime = settleUntil - Date.now();
        if (settleTime > 0) await delay(settleTime, undefined, { signal });
        const pool =
          allowBroadSearch && !semanticPool.length
            ? broadEvidencePool(question)
            : semanticPool;
        // Ranked facts join any broad topic candidates; without a ranker,
        // topic-scoped pools go to the selector directly.
        const selected =
          rank &&
          pool.length &&
          (!candidates.length || candidates.every(isTopicCandidate))
            ? rankedWithTopics(
                await rankedCandidates(rank, question, locale, pool, signal),
                candidates,
              )
            : candidates.length
              ? candidates
              : poolCandidates(semanticPool);
        const result = await askModel(
          select,
          question,
          locale,
          selected,
          signal,
          history,
          prepared.compound,
        );
        if (!result || signal.aborted)
          throw new Error('Invalid selector result');
        failures = 0;
        reply(
          response,
          200,
          result.status === 'unknown' && fallback.status !== 'unknown'
            ? fallback
            : result,
        );
      } catch {
        if (disconnect.signal.aborted || response.destroyed) return;
        // The optional summary model can be unavailable while selection works.
        if (prepared.summary) return unavailable(503);
        if (process.env.ASK_TIMINGS === 'on') {
          console.log(
            JSON.stringify({
              event: 'ask-selector-failure',
              kind: signal.aborted ? 'deadline' : 'upstream',
              ms: Math.round(performance.now() - inferenceStarted),
            }),
          );
        }
        if (signal.aborted) {
          // One subsequent request can reserve the slot while Ollama unwinds.
          // The wait uses that request's existing deadline.
          settleUntil =
            Date.now() +
            Math.min(
              SELECTOR_SETTLE_MS,
              Math.floor(modelTimeout / SETTLE_DEADLINE_DIVISOR),
            );
        } else if (++failures >= 2) {
          retryAt = Date.now() + MINUTE;
        }
        unavailable(503);
      } finally {
        response.off('close', onClose);
        running = false;
      }
    },
  );
  if (local && warmup) {
    server.once('listening', async () => {
      running = true;
      try {
        await warmup(AbortSignal.timeout(WARMUP_TIMEOUT_MS));
        console.log('Ask chat ready');
      } catch {
        console.log(
          'Ask chat warm-up failed; reviewed answers remain available',
        );
      } finally {
        running = false;
      }
    });
  }
  return server;
}

if (import.meta.main) {
  const { ASK_ORIGIN } = process.env;
  // The container has a private interface to nginx and shares Ollama's
  // loopback. The standalone preview binds directly to the host's loopback.
  const container = process.argv.includes('--container');
  if (container && !ASK_ORIGIN)
    throw new Error('Set ASK_ORIGIN to the site origin in container mode');
  if (container && graniteLocal)
    throw new Error('The Granite profile requires a native loopback gateway');
  const configuredTimeout = process.env.ASK_SELECTOR_TIMEOUT_MS;
  if (
    configuredTimeout &&
    ![
      String(UPSTREAM_TIMEOUT),
      String(EXPERIMENTAL_SELECTOR_TIMEOUT_MS),
    ].includes(configuredTimeout)
  )
    throw new Error('ASK_SELECTOR_TIMEOUT_MS must be 6000 or 8000');
  const bind = container ? '0.0.0.0' : LOOPBACK;
  const privatePets =
    !container && !ASK_ORIGIN && graniteLocal
      ? await readFile(
          new URL('../../.local-ask/pets.json', import.meta.url),
          'utf8',
        )
          .then((text) => parseLocalPets(JSON.parse(text)))
          .catch(() => null)
      : null;
  createGateway({
    origins: ASK_ORIGIN ? [ASK_ORIGIN] : LOCAL_ORIGINS,
    rank: graniteLocal ? rankWithGranite : undefined,
    privatePets: privatePets ?? undefined,
    selectorTimeout: configuredTimeout ? Number(configuredTimeout) : undefined,
    warmup: process.env.ASK_WARMUP === 'on' ? warmSelector : undefined,
  }).listen(localPorts.gateway, bind, () =>
    console.log('Ask gateway on http://' + bind + ':' + localPorts.gateway),
  );
}
