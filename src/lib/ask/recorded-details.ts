import { facts, normalize } from './catalog.ts';

/**
 * A kind of detail a question can ask for that a fact must state to answer
 * it. `asked` matches normalized question terms; `stated` matches the raw
 * answer text; `heads` are nouns that ask for it after "which" ("which
 * institution" asks for a place).
 */
interface DetailKind {
  asked: RegExp;
  stated: RegExp;
  heads: readonly string[];
}

const MONTHS =
  'january|february|march|april|may|june|july|august|september|october|november|december|januar|februar|maerz|märz|mai|juni|juli|oktober|dezember';
const YEAR = String.raw`\b(?:1[89]|20)\d{2}\b`;
const ORDINAL_YEAR = String.raw`\b(?:first|second|third|fourth|fifth|final|last|ersten|zweiten|dritten|vierten|fuenften|fünften|letzten) (?:year|jahr)\b`;
const DATE_STATED = `${YEAR}|\\b(?:${MONTHS})\\b|${ORDINAL_YEAR}`;
// A question word opening the question or a part joined by "and"/"or".
const opening = (words: string) =>
  new RegExp(`(?:^|\\b(?:and|und|or|oder) )(?:${words})\\b`);

const VERSION: DetailKind = {
  asked:
    /\b(?:(?:which|what|welche\w*) (?:\w+ ){0,2}(?:version|release)|version number|versionsnummer)\b/,
  stated: /\b(?:version|release|v\d+(?:\.\d+)+|\d+\.\d+\.\d+)\b/i,
  heads: ['version', 'release', 'versionsnummer'],
};
const SECTION: DetailKind = {
  asked: /\b(?:chapters?|sections?|abschnitte?|\w*kapitel\w*)\b/,
  stated: /\b(?:chapters?|sections?|abschnitte?|\w*kapitel\w*)\b/i,
  heads: ['chapter', 'section', 'kapitel', 'abschnitt'],
};
const HARDWARE: DetailKind = {
  asked:
    /\b(?:gpus?|graphics cards?|grafikkarten?|cpus?|processors?|prozessor(?:en)?)\b/,
  stated:
    /\b(?:gpus?|graphics cards?|grafikkarten?|cpus?|processors?|prozessor(?:en)?)\b/i,
  heads: ['gpu', 'cpu', 'processor', 'prozessor', 'grafikkarte'],
};
const PLACE: DetailKind = {
  asked: opening('where|wo'),
  // A preposition before a capitalised name that is not a month: "at FH
  // Vorarlberg", "an der FH Vorarlberg", "At Abacus".
  stated: new RegExp(
    String.raw`\b(?:[Aa]t|[Ii]n|[Bb]ei|[Aa]n der|[Aa]m|[Ii]m)(?: (?:the|der|dem))? (?!(?:${MONTHS})\b)\p{Lu}`,
    'u',
  ),
  heads: [
    'institution',
    'university',
    'universitaet',
    'uni',
    'school',
    'schule',
    'hochschule',
    'fh',
    'college',
    'city',
    'stadt',
    'country',
    'land',
    'location',
    'ort',
    'place',
  ],
};
const DATE: DetailKind = {
  asked: opening(
    '(?:since |seit |until |bis )?(?:when|wann)|what (?:year|month|date|day)',
  ),
  stated: new RegExp(DATE_STATED, 'i'),
  heads: ['year', 'jahr', 'month', 'monat', 'date', 'datum', 'day', 'tag'],
};
const DURATION: DetailKind = {
  asked: opening('how long|wie lange'),
  stated: new RegExp(
    String.raw`${DATE_STATED}|\b\d+ (?:years?|months?|weeks?|days?|jahren?|monaten?|wochen?|tagen?)\b`,
    'i',
  ),
  heads: [],
};

const OPERATING_SYSTEM: DetailKind = {
  asked:
    /\b(?:linux distribution|distribution|distro|operating system|betriebssystem)\b/,
  stated:
    /\b(?:distribution|distro|operating system|betriebssystem|debian|ubuntu|fedora|alpine|centos|nixos|windows|macos|proxmox|truenas|unraid)\b/i,
  heads: ['distribution', 'distro', 'betriebssystem'],
};
const BROWSER: DetailKind = {
  asked: /\b(?:web ?browser|browser)\b/,
  stated: /\b(?:browser|chrome|chromium|firefox|safari)\b/i,
  heads: ['browser', 'webbrowser'],
};

const DETAIL_KINDS = [
  VERSION,
  SECTION,
  HARDWARE,
  PLACE,
  DATE,
  DURATION,
  OPERATING_SYSTEM,
  BROWSER,
];

/** Words after "which" (or "welche…") that may name the asked attribute. */
const MAX_HEAD_WORDS = 2;
const which = /\b(?:which|welche[rsnm]?)\b/g;
const qualifier = /^(?:(?:kind|sort|type) of|art von|art) /;
/** Words that end the noun after "which". */
const headStop = new Set(
  (
    'a an the of for to in at on by with from and or s did does do is was were are has have had ' +
    'can could would will should he she his her it its they their you your we timo timos ' +
    'ist war waren sind hat hatte haben kann konnte wird wurde wurden er sie es sein seine seiner ' +
    'seinem seinen seins der die das den dem des ein eine einen einem bei an mit fuer von im am ' +
    'und oder lief gab ging schrieb kam bot fand hielt nahm half stand'
  ).split(' '),
);
// A German verb after the noun ("welche Programmiersprache nutzt").
const inflectedVerb = /^\w{3,}(?:te|ten|tet|t)$/;
/** Nouns that ask about nothing in particular ("which projects"). */
const genericHeads = new Set(
  'project projekt thing one part teil kind way other andere'.split(' '),
);
/** Category nouns a named modifier specifies ("CI server", "CI-System"). */
const categoryHeads = new Set(
  'system server tool software platform plattform technology technologie service dienst stack'.split(
    ' ',
  ),
);

const PLURAL_ENDINGS = ['s', 'e', 'en', 'n', 'es'];
const sameWord = (a: string, b: string) =>
  a === b ||
  PLURAL_ENDINGS.some((ending) => a === b + ending || b === a + ending);
const inSet = (word: string, set: ReadonlySet<string>) =>
  [...set].some((entry) => sameWord(word, entry));

/** The nouns after each "which" in the terms, before a verb or pronoun. */
function whichHeads(terms: string) {
  return [...terms.matchAll(which)].map((match) => {
    const rest = terms
      .slice(match.index + match[0].length)
      .trim()
      .replace(qualifier, '');
    const head: string[] = [];
    for (const [index, word] of rest.split(' ').entries()) {
      if (
        !word ||
        headStop.has(word) ||
        (index > 0 && inflectedVerb.test(word)) ||
        head.length === MAX_HEAD_WORDS
      )
        break;
      head.push(word);
    }
    return head;
  });
}

/** The detail kinds and literal attribute words the terms ask for. */
function askedDetails(terms: string) {
  const kinds = new Set(DETAIL_KINDS.filter(({ asked }) => asked.test(terms)));
  const words: string[][] = [];
  for (const head of whichHeads(terms)) {
    const kind = DETAIL_KINDS.find(({ heads }) =>
      head.some((word) => heads.some((entry) => sameWord(word, entry))),
    );
    if (kind) {
      kinds.add(kind);
      continue;
    }
    const named = head.filter((word) => !inSet(word, genericHeads));
    const specific =
      named.length > 1
        ? named.filter((word) => !inSet(word, categoryHeads))
        : named;
    if (specific.length) words.push(specific);
  }
  return { kinds, words };
}

/** Answer texts and their vocabulary, with aliases, for the given facts. */
function recorded(ids: readonly string[]) {
  const entries = ids.flatMap((id) => {
    const fact = facts.find((entry) => entry.id === id);
    return fact ? [fact] : [];
  });
  const answers = entries.flatMap(({ answer }) => [answer.en, answer.de]);
  const vocabulary = new Set(
    [
      ...answers,
      ...entries.flatMap(({ aliases, facet }) => [...aliases, facet]),
    ].flatMap((text) => normalize(text).split(' ')),
  );
  return { answers, vocabulary };
}

const unstatedKind = (
  kinds: ReadonlySet<DetailKind>,
  answers: readonly string[],
) =>
  [...kinds].some(
    ({ stated }) => !answers.some((answer) => stated.test(answer)),
  );

/**
 * Whether the question asks for a detail of a recognisable kind (a version,
 * section, hardware, place, date, duration, operating system or browser)
 * that none of the given facts states, in either language. No facts record
 * nothing. The noun after "which" alone never counts: answers often give
 * the value without naming it ("Which colour?" – "a black cat").
 */
export function unrecordedDetail(terms: string, ids: readonly string[]) {
  return unstatedKind(askedDetails(terms).kinds, recorded(ids).answers);
}

/**
 * Positive evidence that the given facts answer the question beyond its
 * topic: it asks for at least one detail, and the facts state every detail
 * kind it asks for and name each noun it asks for after "which" (in an
 * answer, alias or facet).
 */
export function statesAskedDetail(terms: string, ids: readonly string[]) {
  const { kinds, words } = askedDetails(terms);
  const { answers, vocabulary } = recorded(ids);
  return (
    (kinds.size > 0 || words.length > 0) &&
    !unstatedKind(kinds, answers) &&
    words.every((group) => group.every((word) => inSet(word, vocabulary)))
  );
}
