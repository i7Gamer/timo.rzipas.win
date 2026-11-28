// A ranker started before the facts changed reports an older corpus version.
// The gateway then rejects every ranking and quietly sends no evidence to the
// selector, so evaluations must refuse to run against it.
import type { RankFacts } from '../../services/ask/granite.ts';
import { corpusVersion } from '../../src/lib/ask/version.ts';

const PROBE_QUESTION = 'Which project used Flask?';
const PROBE_FACT_ID = 'spotify-python';

export async function assertRankerCorpus(rank: RankFacts, signal: AbortSignal) {
  let reply: unknown;
  try {
    reply = await rank(PROBE_QUESTION, 'en', [PROBE_FACT_ID], signal);
  } catch (error) {
    throw new Error(`Granite ranker unavailable: ${String(error)}`);
  }
  const version =
    reply && typeof reply === 'object' && 'corpusVersion' in reply
      ? reply.corpusVersion
      : undefined;
  if (version === undefined)
    throw new Error('Granite ranker returned no corpus version');
  if (version !== corpusVersion)
    throw new Error(
      `Granite ranker serves corpus ${String(version)}, but the facts are ${corpusVersion}; restart the ranker`,
    );
}
