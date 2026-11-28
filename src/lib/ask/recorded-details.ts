import { facts } from './catalog.ts';

/**
 * Details a question can ask for that a fact must state to answer it: a
 * version number, a document chapter, or the hardware behind a measurement.
 * `asked` matches normalized question terms; `stated` matches answer text.
 */
const DETAIL_KINDS = [
  {
    asked:
      /\b(?:(?:which|what|welche\w*) (?:\w+ ){0,2}(?:version|release)|version number|versionsnummer)\b/,
    stated: /\b(?:version|release|v\d+(?:\.\d+)+|\d+\.\d+\.\d+)\b/i,
  },
  {
    asked: /\b(?:chapters?|kapitel)\b/,
    stated: /\b(?:chapters?|kapitel)\b/i,
  },
  {
    asked:
      /\b(?:gpus?|graphics cards?|grafikkarten?|cpus?|processors?|prozessor(?:en)?)\b/,
    stated:
      /\b(?:gpus?|graphics cards?|grafikkarten?|cpus?|processors?|prozessor(?:en)?)\b/i,
  },
];

/**
 * Whether the question asks for a detail that none of the given facts states,
 * in either language. No facts record nothing.
 */
export function unrecordedDetail(terms: string, ids: readonly string[]) {
  const answers = ids.flatMap((id) => {
    const fact = facts.find((entry) => entry.id === id);
    return fact ? [fact.answer.en, fact.answer.de] : [];
  });
  return DETAIL_KINDS.some(
    ({ asked, stated }) =>
      asked.test(terms) && !answers.some((answer) => stated.test(answer)),
  );
}
