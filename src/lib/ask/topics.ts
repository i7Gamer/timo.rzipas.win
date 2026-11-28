import type { Locale } from '../../i18n';
import {
  CV_OVERVIEW_IDS,
  EXTENDED_PITCH_IDS,
  expandedSummaries,
  MAX_CLAIMS,
  WORK_EXPERIENCE_IDS,
  facts,
  longProjectSummary,
  normalize,
  projectFacts,
  sourcePage,
  sources,
  wordCountSummaries,
  type Fact,
  type SourceId,
} from './catalog.ts';
import { isSingleTypo } from './spelling.ts';

// Broad questions about Timo are matched by topic words, not by whole
// sentences. A topic applies only when every other word is filler, so a
// question that names a project, a technology or “it” keeps its specific route.
// Projects and the homelab are left to the page index, which answers them.

type TopicId =
  | 'hire'
  | 'summary'
  | 'cv'
  | 'work'
  | 'education'
  | 'skills'
  | 'hobbies'
  | 'location';

interface Topic {
  id: TopicId;
  keywords: readonly string[];
  ids: readonly string[];
  /** Key of the reviewed longer summary for “longer” follow-ups. */
  longer?: string;
  /** What the selector sees when no keyword matched. */
  description: Record<Locale, string>;
}

const TOPIC_PREFIX = 'topic:';
const MIN_TYPO_LENGTH = 5;
const MAX_TYPOS = 2;
const LONGER_PROFILE = 'longer summary of timo';

const topics: readonly Topic[] = [
  {
    id: 'hire',
    keywords: [
      'hire',
      'hiring',
      'hired',
      'employ',
      'recruit',
      'recruiting',
      'einstellen',
      'anstellen',
      'einstellung',
      'benefit',
      'benefits',
      'perk',
      'perks',
      'vorteil',
      'vorteile',
      'mehrwert',
      'value',
      'strength',
      'strengths',
      'staerke',
      'staerken',
      'why him',
      'warum ihn',
      'warum er',
      'good fit',
      'stand out',
      'unique',
    ],
    ids: ['abacus-workflow', 'stadler-vpn', 'spotify-python'],
    longer: LONGER_PROFILE,
    description: {
      en: 'Why Timo is worth hiring: his strengths, the value he brings and what makes him stand out.',
      de: 'Warum es sich lohnt, Timo einzustellen: seine Stärken, sein Mehrwert und was ihn auszeichnet.',
    },
  },
  {
    id: 'summary',
    keywords: [
      'summary',
      'summarize',
      'summarise',
      'overview',
      'zusammenfassung',
      'zusammenfassen',
      'ueberblick',
      'uebersicht',
      'intro',
      'introduction',
      'introduce',
      'pitch',
      'bio',
      'profile',
      'profil',
      'vorstellung',
      'vorstellen',
      'who is',
      'wer ist',
      'in a nutshell',
      'tldr',
      'tl dr',
    ],
    ids: [
      'portfolio-pitch',
      'career-role-titles',
      'portfolio-project-inventory',
    ],
    longer: LONGER_PROFILE,
    description: {
      en: 'A short introduction to who Timo is, his roles and his projects.',
      de: 'Eine kurze Vorstellung, wer Timo ist, seine Stellen und Projekte.',
    },
  },
  {
    id: 'cv',
    keywords: ['cv', 'resume', 'lebenslauf', 'curriculum vitae', 'vita'],
    ids: CV_OVERVIEW_IDS,
    longer: 'longer summary of his cv',
    description: {
      en: 'Timo’s CV: his job titles, degree and school.',
      de: 'Timos Lebenslauf: seine Stellen, sein Studium und seine Schule.',
    },
  },
  {
    id: 'work',
    keywords: [
      'experience',
      'experiences',
      'erfahrung',
      'erfahrungen',
      'berufserfahrung',
      'career',
      'karriere',
      'job',
      'jobs',
      'beruf',
      'beruflich',
      'werdegang',
      'employment',
      'work history',
      'work experience',
      'arbeitserfahrung',
    ],
    ids: WORK_EXPERIENCE_IDS,
    longer: 'longer summary of his work experience',
    description: {
      en: 'Timo’s professional experience and the work he did at his employers.',
      de: 'Timos Berufserfahrung und seine Arbeit bei seinen Arbeitgebern.',
    },
  },
  {
    id: 'education',
    keywords: [
      'education',
      'ausbildung',
      'studium',
      'studies',
      'study',
      'studied',
      'degree',
      'degrees',
      'abschluss',
      'abschluesse',
      'school',
      'schule',
      'university',
      'uni',
      'hochschule',
      'bildung',
      'qualification',
      'qualifications',
      'qualifikation',
      'qualifikationen',
    ],
    ids: ['cv-degree', 'cv-matura'],
    description: {
      en: 'Timo’s education: his degree and school.',
      de: 'Timos Ausbildung: sein Studium und seine Schule.',
    },
  },
  {
    id: 'skills',
    keywords: [
      'skills',
      'skill',
      'skillset',
      'faehigkeiten',
      'kenntnisse',
      'kompetenzen',
      'kompetenz',
      'expertise',
      'good at',
      'gut in',
      'gut darin',
      'kann er',
    ],
    ids: ['abacus-workflow', 'spotify-python', 'tutto-stack'],
    description: {
      en: 'Timo’s technical skills and the technologies he works with.',
      de: 'Timos technische Fähigkeiten und die Technologien, mit denen er arbeitet.',
    },
  },
  {
    id: 'hobbies',
    keywords: [
      'hobbies',
      'hobby',
      'freizeit',
      'free time',
      'spare time',
      'interests',
      'interessen',
      'for fun',
    ],
    ids: ['portfolio-leisure'],
    description: {
      en: 'What Timo does in his free time.',
      de: 'Was Timo in seiner Freizeit macht.',
    },
  },
  {
    id: 'location',
    keywords: [
      'location',
      'located',
      'based',
      'standort',
      'wohnort',
      'wohnt',
      'lebt',
      'lives',
      'country',
      'city',
      'stadt',
    ],
    ids: ['portfolio-role-location'],
    description: {
      en: 'Where Timo is based.',
      de: 'Wo Timo ansässig ist.',
    },
  },
];

// Pronouns that refer to an earlier answer (it, that, they, es, das …) are not
// filler: they keep follow-up questions on the subject being discussed.
const filler = new Set(
  (
    'a an the is are was were be been am s his him he hes timo timos rzipa ' +
    'me my i we you your u ur what whats which who how why when where do ' +
    'does did can could would should will have has had please pls plz tell ' +
    'show give list share know about on of for in at to with and or also just ' +
    'really quick short brief little bit some any kind sort ' +
    'mir mich ich du dein deine deinen deiner dir wir er ihn ihm sein seine ' +
    'seinen seiner seinem seines was wie wer warum wieso weshalb welche ' +
    'welcher welches welchen gib gibt zeig zeige erzaehl erzaehle sag sage ' +
    'nenn nenne ueber von zu zum zur im mit der die den dem des ein eine ' +
    'einen einem einer und oder auch bitte kurz kurze kurzer kurzes kurzen ' +
    'etwas mal hat hast haben ist sind bist kann kannst koennte koenntest ' +
    'sollte sollten soll wo ' +
    // Asking for a download still wants the document: “CV download”.
    'download downloads pdf link file datei herunterladen runterladen'
  ).split(' '),
);

/** Whether the visitor wants the file itself: “CV download”, “Lebenslauf PDF”. */
export const downloadRequest =
  /\b(?:download\w*|herunterladen|runterladen|pdf)\b/;

const keywordWords = new Set(
  topics.flatMap(({ keywords }) => keywords.flatMap((k) => k.split(' '))),
);

function repairTypos(words: readonly string[]) {
  let repairs = 0;
  const repaired = words.map((word) => {
    if (
      word.length < MIN_TYPO_LENGTH ||
      filler.has(word) ||
      keywordWords.has(word)
    )
      return word;
    const matches = [...keywordWords].filter((keyword) =>
      isSingleTypo(word, keyword),
    );
    if (matches.length !== 1) return word;
    repairs++;
    return matches[0];
  });
  return repairs <= MAX_TYPOS ? repaired : words;
}

/** Topics named by `terms` (normalized), in question order. */
export function questionTopics(terms: string): TopicId[] {
  const words = repairTypos(terms.split(' ').filter(Boolean));
  if (!words.length) return [];
  const claimed = new Array<TopicId | undefined>(words.length);
  const keywords = topics
    .flatMap(({ id, keywords }) =>
      keywords.map((keyword) => ({ id, words: keyword.split(' ') })),
    )
    // Longer phrases first, so “work experience” wins over single words.
    .sort((a, b) => b.words.length - a.words.length);
  for (const keyword of keywords) {
    for (let start = 0; start + keyword.words.length <= words.length; start++) {
      const span = words.slice(start, start + keyword.words.length);
      if (
        span.every(
          (word, offset) =>
            word === keyword.words[offset] &&
            claimed[start + offset] === undefined,
        )
      )
        for (let offset = 0; offset < span.length; offset++)
          claimed[start + offset] = keyword.id;
    }
  }
  const leftover = words.some(
    (word, index) => claimed[index] === undefined && !filler.has(word),
  );
  if (leftover) return [];
  return [...new Set(claimed.filter((id) => id !== undefined))];
}

function resolvedTopics(terms: string) {
  const found = questionTopics(terms);
  // “summary” only modifies a more specific topic: “cv summary” is the CV.
  const specific = found.filter((id) => id !== 'summary');
  return (specific.length ? specific : found).map((id) =>
    topics.find((topic) => topic.id === id)!,
  );
}

export interface TopicSelection {
  ids: readonly string[];
  /** Set when a requested part got no fact within the claim limit. */
  partial?: true;
}

/**
 * Takes one fact from each list in turn, without repeats, up to the claim
 * limit, so every requested part gets a slot before any part gets a second.
 */
export function interleaveFacts(
  lists: readonly (readonly string[])[],
): TopicSelection {
  const ids: string[] = [];
  const depth = Math.max(0, ...lists.map(({ length }) => length));
  for (let index = 0; index < depth; index++)
    for (const list of lists) {
      const id = list[index];
      if (id !== undefined && !ids.includes(id) && ids.length < MAX_CLAIMS)
        ids.push(id);
    }
  return lists.every((list) => list.some((id) => ids.includes(id)))
    ? { ids }
    : { ids, partial: true };
}

/** Reviewed facts for a broad topic question, or undefined. */
export function topicSelection(terms: string): TopicSelection | undefined {
  const matched = resolvedTopics(terms);
  if (!matched.length) return;
  if (matched.length === 1) return { ids: matched[0].ids };
  return interleaveFacts(matched.map(({ ids }) => ids));
}

/** Reviewed fact ids for a broad topic question, or undefined. */
export function topicFactIds(terms: string): readonly string[] | undefined {
  return topicSelection(terms)?.ids;
}

/** The reviewed longer summary that follows a topic answer. */
export function topicLongerSummary(terms: string) {
  const matched = resolvedTopics(terms);
  return matched.length === 1 ? matched[0].longer : undefined;
}

/**
 * Every reviewed fact a single topic can show, in order: its answer, then the
 * rest of its longer summary. “More” follow-ups walk through this list.
 * Work experience is left to the career follow-ups, which continue by role.
 */
export function topicContinuation(terms: string) {
  const matched = resolvedTopics(terms);
  return matched.length === 1 ? continuationOf(matched[0].id) : undefined;
}

/**
 * One continuation list per topic a question named. Several topics are
 * continued together, so work experience keeps its longer summary there.
 */
export function topicContinuations(terms: string) {
  const matched = resolvedTopics(terms);
  if (matched.length === 1) {
    const pool = continuationOf(matched[0].id);
    return pool ? [pool] : undefined;
  }
  if (!matched.length) return;
  return matched.map(({ ids, longer }) => [
    ...new Set([...ids, ...summaryIds(longer)]),
  ]);
}

/** The facts a topic can show, or undefined for work experience. */
export function continuationOf(id: TopicId) {
  const topic = topics.find((entry) => entry.id === id);
  if (!topic || topic.id === 'work') return;
  return [...new Set([...topic.ids, ...summaryIds(topic.longer)])];
}

function summaryIds(longer: string | undefined): readonly string[] {
  return longer && Object.hasOwn(expandedSummaries, longer)
    ? expandedSummaries[longer as keyof typeof expandedSummaries]
    : [];
}

/**
 * The topic whose whole reviewed answer an earlier reply showed, also when the
 * selector inferred it from a question without topic words. The largest
 * matching topic wins (a CV answer also contains the education facts).
 */
export function answerTopic(answer: string): TopicId | undefined {
  const shown = normalize(answer);
  if (!shown) return;
  const contains = (id: string) => {
    const fact = facts.find((entry) => entry.id === id);
    return Boolean(
      fact &&
      Object.values(fact.answer).some((text) =>
        shown.includes(normalize(text)),
      ),
    );
  };
  const matched = topics
    .filter(({ ids }) => ids.every(contains))
    .sort((a, b) => b.ids.length - a.ids.length);
  if (!matched.length) return;
  if (matched[1] && matched[1].ids.length === matched[0].ids.length) return;
  return matched[0].id;
}

// A summary request is a summary word, an optional length and a subject:
// Timo, a broad topic or one project page.
const summaryWords = new Set([
  'summary',
  'summaries',
  'summarize',
  'summarise',
  'summarized',
  'overview',
  'pitch',
  'recap',
  'rundown',
  'tldr',
  'zusammenfassung',
  'zusammenfassen',
  'ueberblick',
  'uebersicht',
]);
const germanSummarize = {
  verbs: new Set(['fass', 'fasse']),
  particle: 'zusammen',
};
const longWords = new Set([
  'long',
  'longer',
  'detailed',
  'full',
  'complete',
  'extended',
  'lang',
  'lange',
  'langen',
  'langer',
  'laengere',
  'laengeren',
  'ausfuehrlich',
  'ausfuehrliche',
  'ausfuehrlichen',
  'ausfuehrlicher',
  'detailliert',
  'detaillierte',
  'detaillierten',
  'vollstaendige',
]);
const lengthUnits = new Set(['word', 'words', 'wort', 'woerter', 'woertern']);
const summaryConnectors = new Set(
  (
    'of on for in write make create around roughly approximately um rund ' +
    'etwa ca circa ungefaehr schreib schreibe erstell erstelle nice good ' +
    'schoene gute knapp knappe'
  ).split(' '),
);
/** Requested word counts from this length on get the long summary. */
const LONG_SUMMARY_MIN_WORDS = 100;
const projectWords = ['project', 'projects', 'projekt', 'projekte'];
const longTopicSummaries: Partial<Record<TopicId, readonly string[]>> = {
  summary: EXTENDED_PITCH_IDS,
  hire: EXTENDED_PITCH_IDS,
  cv: wordCountSummaries.cv,
  work: wordCountSummaries.work,
};

const words = (phrase: string) => normalize(phrase).split(' ');
const projectNames = Object.keys(projectFacts).map((page) => {
  const pageSources = Object.keys(sources).filter(
    (id) => sourcePage(id as SourceId) === page,
  ) as SourceId[];
  return {
    page,
    names: new Set([
      ...projectWords,
      ...page
        .split('/')
        .filter(Boolean)
        .slice(1)
        .flatMap((slug) => slug.split('-')),
      ...pageSources.flatMap((id) => [
        ...sources[id].topics.flatMap(words),
        // “Hearthcoil · Project story” names the project before the dot.
        ...Object.values(sources[id].label).flatMap((label) =>
          words(label.split('·')[0]),
        ),
      ]),
    ]),
  };
});

/** Reviewed fact ids for a summary request, or undefined. */
export function summaryFactIds(terms: string): readonly string[] | undefined {
  const all = terms.split(' ').filter(Boolean);
  const germanVerb =
    all.includes(germanSummarize.particle) &&
    all.some((word) => germanSummarize.verbs.has(word));
  if (!germanVerb && !all.some((word) => summaryWords.has(word))) return;
  let long = false;
  const subject: string[] = [];
  for (const [index, word] of all.entries()) {
    if (longWords.has(word)) long = true;
    else if (/^\d+$/.test(word) && lengthUnits.has(all[index + 1] ?? ''))
      long ||= Number(word) >= LONG_SUMMARY_MIN_WORDS;
    else if (
      !summaryWords.has(word) &&
      !lengthUnits.has(word) &&
      !summaryConnectors.has(word) &&
      !filler.has(word) &&
      !(
        germanVerb &&
        (germanSummarize.verbs.has(word) || word === germanSummarize.particle)
      )
    )
      subject.push(word);
  }
  if (!subject.length)
    return long
      ? EXTENDED_PITCH_IDS
      : topics.find(({ id }) => id === 'summary')!.ids;

  const named = questionTopics(subject.join(' ')).filter(
    (id) => id !== 'summary',
  );
  if (named.length === 1) {
    const topic = topics.find(({ id }) => id === named[0])!;
    return (long && longTopicSummaries[topic.id]) || topic.ids;
  }
  const pages = projectNames.filter(({ names }) =>
    subject.every((word) => names.has(word)),
  );
  if (pages.length !== 1) return;
  const { page } = pages[0];
  return long
    ? longProjectSummary(page)
    : projectFacts[page].slice(0, MAX_CLAIMS);
}

/** Labels offered as buttons when a question could not be answered. */
export const TOPIC_PROMPTS = {
  en: ['Work experience', 'Projects', 'CV', 'Why hire Timo?'],
  de: ['Berufserfahrung', 'Projekte', 'Lebenslauf', 'Warum Timo einstellen?'],
} as const satisfies Record<Locale, readonly string[]>;

const candidates: readonly Fact[] = topics.map((topic) => ({
  id: TOPIC_PREFIX + topic.id,
  sourceId: facts.find(({ id }) => id === topic.ids[0])!.sourceId,
  facet: 'topic overview',
  aliases: [],
  answer: topic.description,
  evidence: [],
}));

/** One selector candidate per topic, used when no fact matched. */
export function topicCandidates(): Fact[] {
  return [...candidates];
}

export function isTopicCandidate({ id }: Pick<Fact, 'id'>) {
  return id.startsWith(TOPIC_PREFIX);
}

/**
 * Replaces chosen topic candidates with their reviewed facts, giving every
 * chosen topic or fact a slot. `topicIds` are the facts that came from topics.
 */
export function topicExpansion(matches: readonly Fact[]) {
  const lists = matches.map(({ id }) =>
    isTopicCandidate({ id })
      ? (topics.find((topic) => TOPIC_PREFIX + topic.id === id)?.ids ?? [])
      : [id],
  );
  const { ids, partial } = interleaveFacts(lists);
  const fromTopics = new Set(
    matches.flatMap((match, index) =>
      isTopicCandidate(match) ? lists[index] : [],
    ),
  );
  return {
    facts: ids.flatMap((id) => facts.filter((fact) => fact.id === id)),
    topicIds: new Set(ids.filter((id) => fromTopics.has(id))),
    ...(partial ? { partial } : {}),
  };
}

/** Replaces chosen topic candidates with their reviewed facts. */
export function expandTopicMatches(matches: readonly Fact[]): Fact[] {
  return topicExpansion(matches).facts;
}
