import type { Locale } from '../../src/i18n';
import { facts } from '../../src/lib/ask/catalog.ts';
import { corpusVersion } from '../../src/lib/ask/version.ts';
import { LOOPBACK } from './local-profile.ts';

const GRANITE_PORT = 4515;
const RANK_TIMEOUT_MS = 300;
const MAX_RANKED_FACTS = 2;

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
