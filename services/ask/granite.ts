import type { Locale } from '../../src/i18n';
import { facts, type Fact } from '../../src/lib/ask/catalog.ts';
import { isTopicCandidate } from '../../src/lib/ask/topics.ts';
import { corpusVersion } from '../../src/lib/ask/version.ts';
import { LOOPBACK } from './local-profile.ts';
import { MAX_CANDIDATES, rankedWithTopics } from './selection.ts';

const GRANITE_PORT = 4515;
const RANK_TIMEOUT_MS = 300;
/** Ranked facts per request; keep equal to MAX_RESULTS in granite.py. */
export const MAX_RANKED_FACTS = 4;

export type RankFacts = (
  question: string,
  locale: Locale,
  ids: readonly string[],
  signal: AbortSignal,
) => Promise<unknown>;

export function graniteRanker(port = GRANITE_PORT): RankFacts {
  return async (question, locale, ids, signal) => {
    const response = await fetch(`http://${LOOPBACK}:${port}/rank`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, locale, ids }),
      redirect: 'error',
      signal: AbortSignal.any([signal, AbortSignal.timeout(RANK_TIMEOUT_MS)]),
    });
    return response.ok ? response.json() : null;
  };
}

export const rankWithGranite = graniteRanker();

export async function rankedCandidates(
  rank: RankFacts,
  question: string,
  locale: Locale,
  allowed: readonly string[],
  signal: AbortSignal,
) {
  // The optional local ranker may be stopped. Keep the reviewed fallback
  // available, while the gateway still enforces its overall deadline.
  const result = await rank(question, locale, allowed, signal).catch(
    () => null,
  );
  signal.throwIfAborted();
  if (!result || typeof result !== 'object') return [];
  const { corpusVersion: version, ids } = result as {
    corpusVersion?: unknown;
    ids?: unknown;
  };
  if (
    version !== corpusVersion ||
    !Array.isArray(ids) ||
    ids.length > MAX_RANKED_FACTS ||
    new Set(ids).size !== ids.length ||
    !ids.every((id) => typeof id === 'string' && allowed.includes(id))
  ) {
    return [];
  }
  return ids.flatMap((id) => {
    const fact = facts.find((entry) => entry.id === id);
    return fact ? [fact] : [];
  });
}

/** Ranked facts a rescue pass may add beside weak strict candidates. */
export const RESCUED_FACTS = 2;
/** Time the rescue pass may spend before the strict candidates go alone. */
export const RESCUE_BUDGET_MS = RANK_TIMEOUT_MS;

/**
 * The strict candidates plus up to RESCUED_FACTS ranked facts from the rescue
 * pool, within the selector's candidate limit. A slow or failed ranker leaves
 * the candidates unchanged; only an aborted request fails.
 */
export async function withRescue(
  rank: RankFacts,
  question: string,
  locale: Locale,
  candidates: readonly Fact[],
  pool: readonly string[],
  signal: AbortSignal,
  budgetMs = RESCUE_BUDGET_MS,
): Promise<Fact[]> {
  if (!pool.length) return [...candidates];
  let ranked: Fact[];
  try {
    ranked = await rankedCandidates(
      rank,
      question,
      locale,
      pool,
      AbortSignal.any([signal, AbortSignal.timeout(budgetMs)]),
    );
  } catch {
    // rankedCandidates only throws when its signal aborts: here the budget.
    signal.throwIfAborted();
    return [...candidates];
  }
  const rescued = ranked
    .filter(({ id }) => !candidates.some((fact) => fact.id === id))
    .slice(0, RESCUED_FACTS);
  if (candidates.every(isTopicCandidate))
    return rankedWithTopics(rescued, candidates);
  return [...candidates.slice(0, MAX_CANDIDATES - rescued.length), ...rescued];
}
