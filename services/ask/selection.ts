import {
  documentAnswer,
  exampleMatch,
  facts,
  normalize,
  outOfScope,
  sources,
  MAX_CLAIMS,
  type AskStatus,
  type Fact,
} from '../../src/lib/ask/catalog.ts';
import { corpusVersion } from '../../src/lib/ask/version.ts';
import {
  careerCandidates,
  careerFollowUpScope,
  isEmployerScope,
} from '../../src/lib/ask/career.ts';
import {
  approvedAnswer,
  asksAboutAICoding,
  asksUnsupportedDetail,
  modelOverviewIds,
  needsDatedWorkEvidence,
  profileFollowUp,
  profileHighlightIds,
  profileQuestionNote,
  questionClauses,
  reviewedCompoundFactIds,
  reviewedFactId,
  summaryOverviewIds,
  WORK_EXPERIENCE_IDS,
} from '../../src/lib/ask/reviewed-questions.ts';
import type { ChatTurn } from '../../src/lib/ask/history.ts';
import {
  projectCandidates,
  projectFollowUp,
  PROJECT_OVERVIEW_IDS,
  PROJECT_OVERVIEW_PATTERNS,
} from '../../src/lib/ask/project-context.ts';
import { editDistance } from '../../src/lib/ask/spelling.ts';
import type { Locale } from '../../src/i18n';

const MAX_CANDIDATES = 6;
const MIN_SPELLING_LENGTH = 5;
const SINGLE_EDIT = 1;
const portfolioReference =
  /\b(?:timo|rzipa|portfolio|he|him|his|er|ihn|ihm|sein(?:e|en|er|em|es)?)\b/;
const employerInWorkQuestion =
  /\b(?:work|jobs?|roles?|positions?|employment|internships?|berufserfahrung|stellen?|praktika|gearbeitet)\b.*?\b(?:at|bei) (.+)$/;
const publicFactIds = facts.map(({ id }) => id);
const retrievalWords = new Set(
  [
    'work experience professional experience career history berufserfahrung beruflichen werdegang',
    ...Object.values(sources).flatMap(({ topics }) => topics),
    ...facts.flatMap(({ aliases, standalone }) => [
      ...aliases,
      ...(standalone ?? []),
    ]),
  ].flatMap((phrase) => normalize(phrase).split(' ')),
);

function recoverSpelling(terms: string) {
  return terms
    .split(' ')
    .map((word) => {
      if (word.length < MIN_SPELLING_LENGTH || retrievalWords.has(word))
        return word;
      const matches = [...retrievalWords].filter(
        (candidate) =>
          candidate[0] === word[0] &&
          Math.abs(candidate.length - word.length) <= SINGLE_EDIT &&
          editDistance(word, candidate) === SINGLE_EDIT,
      );
      return matches.length === 1 ? matches[0] : word;
    })
    .join(' ');
}

export function broadEvidencePool(question: string) {
  const terms = normalize(question);
  const employer = employerInWorkQuestion.exec(terms)?.[1];
  if (!employer) return portfolioReference.test(terms) ? publicFactIds : [];
  return facts
    .filter(({ sourceId }) => {
      const source = sources[sourceId];
      return [...source.topics, ...Object.values(source.label)].some((label) =>
        (' ' + normalize(label) + ' ').includes(' ' + employer + ' '),
      );
    })
    .map(({ id }) => id);
}

type Selection = { status: AskStatus | 'clarify'; slots: number[] };
export type SelectFacts = (
  question: string,
  locale: Locale,
  candidates: Fact[],
  signal: AbortSignal,
  history?: readonly ChatTurn[],
  clarifyAbout?: string,
) => Promise<unknown>;

const reviewedQuestions = [
  {
    id: 'spotify-rewrite',
    questions: [
      'Was the Spotify tracker an original project or a rewrite?',
      'War SpotifyTracker ein eigenes Projekt oder eine Neuentwicklung?',
    ],
  },
  {
    id: 'spotify-reconciliation-example',
    questions: [
      'What was a tricky SpotifyTracker bug?',
      'How did SpotifyTracker stop duplicate plays after a long pause?',
      'Welchen schwierigen Fehler hat Timo in SpotifyTracker behoben?',
      'Wie verhindert SpotifyTracker doppelte Wiedergaben nach einer langen Pause?',
    ],
  },
  {
    id: 'hearthcoil-game',
    questions: ['What inspired Hearthcoil?', 'Was hat Hearthcoil inspiriert?'],
  },
  {
    id: 'hearthcoil-contribution',
    questions: [
      'How does Timo develop attack animations?',
      'How does Timo make attack animation references for Hearthcoil?',
      'Wie erstellt Timo Animationsreferenzen für Hearthcoil?',
    ],
  },
  {
    id: 'hearthcoil-playtest',
    questions: [
      'How does Timo playtest Hearthcoil?',
      'Wie testet Timo Hearthcoil im Spiel?',
    ],
  },
  {
    id: 'abacus-recognition',
    questions: [
      'Did Timo develop automatic document recognition at Abacus?',
      'Hat Timo die automatische Belegerkennung bei Abacus entwickelt?',
    ],
  },
];

// These whole-question patterns cover broad requests that have direct evidence.
// Keep them narrow so a specific or unsupported premise still reaches selection.
const overviews = [
  {
    patterns: PROJECT_OVERVIEW_PATTERNS,
    ids: PROJECT_OVERVIEW_IDS,
  },
  {
    patterns: [
      'what (?:work |professional )?experience (?:does timo have|do you have)',
      'what (?:does timo do|do you do)(?: for a living)?',
      '(?:give me (?:a quick |a brief |an )?overview of|summari[sz]e|tell me about) what (?:you do|timo does)(?: for a living)?',
      '(?:tell me about|walk me through) (?:your|timo s|his) (?:work|experience|career)',
      'who is timo(?: rzipa)?',
      'was (?:macht timo|machst du)(?: beruflich)?',
      'welche (?:berufs)?erfahrung (?:hat timo|hast du)',
      'erzaehl mir von (?:deiner|timos|seiner) (?:arbeit|berufserfahrung)',
    ],
    ids: WORK_EXPERIENCE_IDS,
  },
  {
    patterns: [
      'what (?:is|s) (?:your|timo s|his) (?:technical|software engineering) background',
      'tell me about (?:your|timo s|his) (?:technical|software engineering) background',
      'was ist (?:dein|sein|timos) technischer hintergrund',
    ],
    ids: ['cv-degree', 'abacus-workflow', 'spotify-python'],
  },
  {
    patterns: [
      'what experience (?:do you have|does timo have) (?:with|in) (?:software |automated )?testing',
      'how (?:do you|does timo) test (?:your|his) (?:code|software)',
      'welche erfahrung (?:hast du|hat timo) mit (?:softwaretests|testen|automatisierten tests)',
    ],
    ids: ['abacus-reviews-tests', 'hearthcoil-rules-testing'],
  },
  {
    patterns: [
      'how (?:did you|did timo) make (?:the )?(?:fights|combat) easier to test',
      'wie (?:hast du|hat timo) (?:die )?(?:kaempfe|das kampfverhalten) leichter testbar gemacht',
    ],
    ids: ['hearthcoil-rules-testing'],
  },
  {
    patterns: [
      'tell me more about (?:the game )?hearthcoil',
      'erzaehl mir mehr (?:von|ueber) hearthcoil',
      'mir mehr (?:von|ueber) hearthcoil erzaehlen',
    ],
    ids: [
      'hearthcoil-game',
      'hearthcoil-contribution',
      'hearthcoil-rules-testing',
    ],
  },
  {
    patterns: [
      'how (?:do you|does timo) keep (?:several |multiple )?coding agents on track',
      'how (?:do you|does timo) (?:coordinate|manage|track) (?:several |multiple )?coding agents',
      'wie (?:behaeltst du|behaelt timo) bei (?:mehreren )?coding agents den ueberblick',
      'wie (?:koordinierst du|koordiniert timo) (?:mehrere )?coding agents',
    ],
    ids: ['hearthcoil-supervisor', 'hearthcoil-supervisor-verification'],
  },
  {
    patterns: [
      '(?:give me (?:a quick |a brief |an )?overview of|summari[sz]e) what (?:timo did|you did|timo does|you do) at abacus',
      'zusammenfassen was (?:du|timo) bei abacus (?:machst|macht|gemacht hast|gemacht hat)',
    ],
    ids: ['abacus-workflow', 'abacus-reviews-tests'],
  },
  {
    patterns: [
      'what (?:programming )?languages (?:does (?:he|timo) use|do you use|does timo know)',
      'what technologies (?:does timo use|do you use)',
      'welche (?:programmier)?sprachen (?:nutzt|kennt|verwendet) timo',
      'welche (?:programmier)?sprachen (?:nutzt|kennst|verwendest) du',
    ],
    ids: ['abacus-workflow', 'spotify-python', 'tutto-stack'],
  },
].map(({ patterns, ids }) => ({
  question: wholeQuestion(patterns),
  ids,
}));

function wholeQuestion(patterns: string[]) {
  return new RegExp(
    '^(?:(?:can|could|would) you |(?:kannst|koenntest) du )?(?:please |bitte )?(?:' +
      patterns.join('|') +
      ')(?: please| bitte)?$',
  );
}

const topicOverviews = [
  { topic: 'spotify ?tracker|spotify stats tracker', id: 'spotify-rewrite' },
  { topic: 'abacus', id: 'abacus-workflow' },
  { topic: 'myspeed|my speed', id: 'myspeed-fork' },
  { topic: 'tutto', id: 'tutto-modes' },
  { topic: 'hearthcoil', id: 'hearthcoil-game' },
  { topic: 'hearthcoil supervisor', id: 'hearthcoil-supervisor' },
  { topic: 'carini', id: 'carini-team' },
  { topic: 'bachelor thesis|bachelorarbeit', id: 'bachelor-contribution' },
].map(({ topic, id }) => {
  const subject = '(?:' + topic + ')';
  return {
    id,
    question: wholeQuestion([
      '(?:what is|tell me about|was ist|erzaehl mir (?:von|ueber)) (?:the |your |deine |der |die |das )?' +
        subject,
      'what (?:did timo|did you|does timo|do you) (?:do|work on) (?:at|on|for) ' +
        subject,
      'was (?:macht timo|machst du) bei ' + subject,
      'was (?:hat timo|hast du) bei ' + subject + ' gemacht',
    ]),
  };
});

// These details are absent from the named public sources. Compound questions
// still reach the selector so it can return the supported part.
const missingDetails = [
  {
    topics: sources.abacus.topics,
    patterns: [
      /\b(?:ocr|recognition|beleg(?:erkennung|e)?)\b/,
      /\b(?:vendor|supplier|suppli(?:es|ed)|anbieter|lieferant|liefert|lieferte|hersteller)\b/,
    ],
  },
  {
    topics: sources.stadler.topics,
    patterns: [
      /\b(?:certificates?|zertifikat(?:e|en)?)\b/,
      /\b(?:vendor|supplier|suppli(?:es|ed)|sells|sold|issuer|issued|anbieter|lieferant|hersteller|stamm(?:t|en)|ausgestellt)\b/,
    ],
  },
  {
    topics: sources.myspeed.topics,
    patterns: [
      /\b(?:hosts?|hosted|hosting|gehostet|hosting anbieter)\b/,
      /\b(?:who|wer|cloud provider|cloud anbieter|hoster|anbieter)\b/,
    ],
  },
  {
    topics: sources.myspeed.topics,
    patterns: [
      /\b(?:project management (?:method|framework|process)|agile (?:method|framework|methode)|projektmanagementmethode)\b/,
    ],
  },
  {
    topics: sources.carini.topics,
    patterns: [
      /\b(?:programming language|programmiersprache)\b/,
      /\b(?:document view(?:er)?|dokumentenansicht)\b/,
    ],
  },
  {
    topics: sources.bachelor.topics,
    patterns: [/\b(?:title|titel)\b/],
  },
  {
    topics: sources.hearthcoil.topics,
    patterns: [
      /\b(?:release date|published|publishing studio|veroeffentlicht|veroeffentlichungsdatum)\b/,
    ],
  },
  {
    topics: sources.hearthcoil.topics,
    patterns: [
      /\b(?:suit|anzug)\b/,
      /\b(?:vendor|supplier|supplied|manufacturer|hersteller|lieferant)\b/,
    ],
  },
  {
    topics: [...sources.cv.topics, 'FH Vorarlberg'],
    patterns: [/\b(?:master(?: s)? degree|masterabschluss|masterstudium)\b/],
  },
];
function matchingLength(terms: string, aliases: readonly string[]) {
  const haystack = ' ' + terms + ' ';
  return Math.max(
    0,
    ...aliases.map((alias) => {
      const phrase = normalize(alias);
      return haystack.includes(' ' + phrase + ' ')
        ? phrase.split(' ').length
        : 0;
    }),
  );
}

export function shortlist(question: string) {
  const terms = normalize(question);
  const development = asksAboutAICoding(terms);
  return facts
    .filter(({ id }) => !development || id !== 'tutto-coach')
    .map((fact) => {
      const topic = matchingLength(terms, sources[fact.sourceId].topics);
      const facet = matchingLength(terms, fact.aliases);
      const standalone = matchingLength(terms, fact.standalone ?? []);
      const score = topic && facet ? 3 * topic + facet : standalone;
      return { fact, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CANDIDATES)
    .map(({ fact }) => fact);
}

function verifiedDecision(
  value: unknown,
  candidates: Fact[],
  canClarify: boolean,
) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { status, slots } = value as Selection;
  if (
    Object.keys(value).length !== 2 ||
    !['answer', 'partial', 'unknown', 'clarify'].includes(status) ||
    (status === 'clarify' && !canClarify) ||
    !Array.isArray(slots) ||
    slots.length > MAX_CLAIMS ||
    (status === 'unknown' || status === 'clarify') !== (slots.length === 0) ||
    new Set(slots).size !== slots.length ||
    slots.some(
      (slot) => !Number.isInteger(slot) || slot < 1 || slot > candidates.length,
    )
  )
    return null;
  return { status, matches: slots.map((slot) => candidates[slot - 1]) };
}

function prepareExactQuestion(
  question: string,
  locale: Locale,
  history: readonly ChatTurn[] = [],
  boundedOnly = false,
) {
  const terms = profileFollowUp(normalize(question), history);
  const unknown = documentAnswer([], 'unknown', 'index', locale, corpusVersion);
  if (outOfScope.test(terms) || profileQuestionNote(terms, locale, question))
    return { fallback: unknown, candidates: [], semanticPool: [] };
  const careerScope = careerFollowUpScope(terms, history);
  const approved = careerScope ? undefined : approvedAnswer(terms, question);
  const reviewed = (approved?.ids ?? []).flatMap((id) => {
    const fact = facts.find((entry) => entry.id === id);
    return fact ? [fact] : [];
  });
  if (approved && reviewed.length)
    return {
      fallback: documentAnswer(
        reviewed,
        approved.partial ||
          reviewed.length < approved.ids.length ||
          reviewed.some(({ partial }) => partial)
          ? 'partial'
          : 'answer',
        'index',
        locale,
        corpusVersion,
        approved.missing,
      ),
      candidates: [],
      semanticPool: [],
      ...(summaryOverviewIds(terms) && !approved.partial
        ? { summary: true }
        : {}),
    };
  const development = asksAboutAICoding(terms);
  if (
    needsDatedWorkEvidence(terms) ||
    (questionClauses(question).length <= 1 &&
      (development ||
        asksUnsupportedDetail(terms) ||
        missingDetails.some(
          ({ topics, patterns }) =>
            matchingLength(terms, topics) &&
            patterns.every((pattern) => pattern.test(terms)),
        )))
  ) {
    return { fallback: unknown, candidates: [], semanticPool: [] };
  }

  const highlightIds = profileHighlightIds(terms, history);
  if (highlightIds) {
    const candidates = highlightIds.flatMap((id) =>
      facts.filter((fact) => fact.id === id),
    );
    const [highlight] = candidates;
    return {
      fallback: highlight
        ? documentAnswer([highlight], 'answer', 'index', locale, corpusVersion)
        : unknown,
      candidates,
      semanticPool: [],
    };
  }

  if (careerScope) {
    const candidates = careerCandidates(history, careerScope);
    const fallbackCandidates = isEmployerScope(careerScope)
      ? candidates.slice(0, 1)
      : candidates;
    return {
      fallback: candidates.length
        ? documentAnswer(
            fallbackCandidates,
            fallbackCandidates.some(({ partial }) => partial)
              ? 'partial'
              : 'answer',
            'index',
            locale,
            corpusVersion,
          )
        : unknown,
      candidates,
      semanticPool: [],
    };
  }

  const projectContext = projectFollowUp(terms, history);
  if (projectContext) {
    const candidates = projectCandidates(history, projectContext.projectId);
    return {
      fallback:
        projectContext.listRequested && candidates.length
          ? documentAnswer(
              candidates,
              candidates.some(({ partial }) => partial) ? 'partial' : 'answer',
              'index',
              locale,
              corpusVersion,
            )
          : unknown,
      candidates,
      semanticPool: [],
    };
  }

  const overviewIds = modelOverviewIds(terms);
  if (overviewIds) {
    const details = overviewIds.flatMap((id) =>
      facts.filter((fact) => fact.id === id),
    );
    if (details.length)
      return {
        fallback: documentAnswer(
          details,
          'answer',
          'index',
          locale,
          corpusVersion,
        ),
        candidates: details,
        semanticPool: [],
      };
  }

  const direct = reviewedQuestions.find(({ questions }) =>
    questions.some((sample) => normalize(sample) === terms),
  );
  const overview = overviews.find(({ question }) => question.test(terms));
  const topic = topicOverviews.find(({ question }) => question.test(terms));
  const ids = overview?.ids ?? [
    exampleMatch(question)?.id ??
      reviewedFactId(terms) ??
      direct?.id ??
      topic?.id,
  ];
  const matches = ids.flatMap((id) => {
    const fact = facts.find((fact) => fact.id === id);
    return fact ? [fact] : [];
  });
  if (matches.length) {
    return {
      fallback: documentAnswer(
        matches,
        matches.some(({ partial }) => partial) ? 'partial' : 'answer',
        'index',
        locale,
        corpusVersion,
      ),
      candidates: [],
      semanticPool: [],
    };
  }
  if (boundedOnly)
    return {
      fallback: unknown,
      candidates: [],
      semanticPool: [],
      retrievalRequired: true,
    };
  const candidates = shortlist(question);
  const semanticPool = candidates.length
    ? []
    : facts
        .filter(
          ({ id, sourceId }) =>
            (!development || id !== 'tutto-coach') &&
            matchingLength(terms, sources[sourceId].topics),
        )
        .map(({ id }) => id);
  return {
    fallback: unknown,
    candidates,
    semanticPool,
    allowBroadSearch: !candidates.length && !semanticPool.length,
  };
}

export function prepareBoundedQuestion(
  question: string,
  locale: Locale,
  history: readonly ChatTurn[] = [],
) {
  const prepared = prepareExactQuestion(question, locale, history, true);
  return {
    ...prepared,
    retrievalRequired:
      'retrievalRequired' in prepared && prepared.retrievalRequired,
  };
}

export function prepareQuestion(
  question: string,
  locale: Locale,
  history: readonly ChatTurn[] = [],
) {
  const exact = prepareExactQuestion(question, locale, history);
  if (!exact.allowBroadSearch) return exact;
  const terms = normalize(question);
  const corrected = recoverSpelling(terms);
  if (corrected === terms) return exact;
  const recovered = prepareExactQuestion(corrected, locale, history);
  const ids = recovered.fallback.claims.map(({ id }) => id);
  return {
    ...exact,
    candidates: recovered.candidates.length
      ? recovered.candidates
      : facts.filter(({ id }) => ids.includes(id)),
    semanticPool: recovered.semanticPool,
  };
}

export async function askModel(
  select: SelectFacts,
  question: string,
  locale: Locale,
  candidates: Fact[],
  signal: AbortSignal,
  history?: readonly ChatTurn[],
) {
  const projectContext = projectFollowUp(normalize(question), history ?? []);
  const focus = projectContext?.focus;
  const selectionHistory = projectContext?.overview
    ? [projectContext.overview]
    : history;
  const decision = verifiedDecision(
    await select(
      question,
      locale,
      candidates,
      signal,
      selectionHistory,
      ...(focus ? ([focus.label] as const) : []),
    ),
    candidates,
    Boolean(focus),
  );
  if (!decision) return null;
  const { status } = decision;
  let { matches } = decision;
  if (status === 'clarify' && focus)
    return {
      ...documentAnswer([], 'unknown', 'local', locale, corpusVersion),
      clarifyProject: focus.id,
    };
  if (status === 'clarify') return null;
  const clauses = questionClauses(question);
  let additionalUnanswered = false;
  if (matches.length && clauses.length > 1) {
    const scope = normalize(question);
    const covered = clauses.map(
      (clause) =>
        new Set([
          ...prepareBoundedQuestion(
            clause,
            locale,
            history,
          ).fallback.claims.map(({ id }) => id),
          ...reviewedCompoundFactIds(normalize(clause), scope),
        ]),
    );
    matches = matches.filter(({ id }) => covered.some((ids) => ids.has(id)));
    if (!matches.length)
      return documentAnswer([], 'unknown', 'local', locale, corpusVersion);
    additionalUnanswered = covered.some(
      (ids) => !matches.some(({ id, partial }) => ids.has(id) && !partial),
    );
  }
  return documentAnswer(
    matches,
    additionalUnanswered || matches.some((fact) => fact.partial)
      ? 'partial'
      : status,
    'local',
    locale,
    corpusVersion,
    additionalUnanswered ? 'additional-question' : undefined,
  );
}
