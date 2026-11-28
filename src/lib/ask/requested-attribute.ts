import { facts, normalize, sources } from './catalog.ts';

/**
 * Positive support for what a question requests, for reviewed routes that
 * match on keywords: a route that recognises the subject ("SpotifyTracker
 * Compare view benchmark") must not answer a question about an attribute its
 * fact does not record ("Which statistical test …?").
 */

/** A request for an amount, which only a stated number answers. */
const asksAmount =
  /\b(?:how (?:much|many)|wie (?:viel\w*|hoch)|was kostet|cost\w*|price\w*|preis\w*|kosten\w*)\b/;
const statesNumber = /\d/;

/** Opening words before the requested noun: "what is the", "wie lautet der". */
const opening =
  /^(?:what|which|welche[rsnm]?|wie (?:lautete|lautet|hiess|heisst)|was (?:ist|war))(?: (?:is|was|are|were|s|ist|war|waren|sind))?(?: (?:the|a|an|der|die|das|den|dem|des|ein|eine|einen))? /;
/** Words that link the requested noun to the noun it belongs to. */
const link = new Set('of von des der'.split(' '));
/** Qualifiers that narrow the requested noun without changing it. */
const qualifiers =
  /^(?:exact|precise|full|complete|official|genaue?\w*|exakte?\w*|vollstaendige?\w*|offizielle?\w*)$/;
const articles = new Set(
  'the a an der die das den dem des ein eine'.split(' '),
);
/** Words that end the requested noun phrase. */
const stop = new Set(
  (
    'to in at on by with from for and or s did does do is was were are has have had can ' +
    'could would will should he she his her it its they their you your we timo timos ' +
    'ist war waren sind hat hatte haben kann konnte wird wurde wurden er sie es sein ' +
    'seine seiner seinem seinen seines bei an mit fuer im am und oder zu'
  ).split(' '),
);
/** At most this many nouns form one requested phrase. */
const MAX_PHRASE_WORDS = 2;

/**
 * The nouns the question requests: the phrase after an opening question word
 * and each phrase it belongs to ("the title of the introduction").
 */
function requestedWords(terms: string) {
  const match = opening.exec(terms);
  if (!match) return [];
  const words: string[] = [];
  let phrase = 0;
  for (const word of terms.slice(match[0].length).split(' ')) {
    if (link.has(word) && phrase) {
      phrase = 0;
      continue;
    }
    if ((articles.has(word) || qualifiers.test(word)) && !phrase) continue;
    if (!word || stop.has(word) || phrase === MAX_PHRASE_WORDS) break;
    words.push(word);
    phrase++;
  }
  return words;
}

const PLURAL_ENDINGS = ['s', 'e', 'en', 'n', 'es'];
const sameWord = (a: string, b: string) =>
  a === b ||
  PLURAL_ENDINGS.some((ending) => a === b + ending || b === a + ending);

/** Words the facts record, with their aliases, facets and source topics. */
function supportedVocabulary(ids: readonly string[]) {
  const entries = facts.filter(({ id }) => ids.includes(id));
  return new Set(
    entries
      .flatMap(({ answer, aliases, facet, sourceId }) => [
        answer.en,
        answer.de,
        facet,
        ...aliases,
        ...sources[sourceId].topics,
      ])
      .flatMap((text) => normalize(text).split(' ')),
  );
}

/**
 * Whether the facts support what the question requests: a stated number for
 * an amount, and every requested noun in their wording or among the nouns
 * the route itself answers (`requests`). A question that names
 * no requested noun ("How is this website hosted?") asks about the subject the
 * route already recognised.
 */
export function supportsRequest(
  terms: string,
  ids: readonly string[],
  requests: readonly string[] = [],
) {
  const answers = facts
    .filter(({ id }) => ids.includes(id))
    .flatMap(({ answer }) => [answer.en, answer.de]);
  if (
    asksAmount.test(terms) &&
    !answers.some((text) => statesNumber.test(text))
  )
    return false;
  const vocabulary = [...supportedVocabulary(ids), ...requests];
  return requestedWords(terms).every((word) =>
    vocabulary.some((known) => sameWord(word, known)),
  );
}
