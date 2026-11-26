import type { Locale } from '../../i18n';
import {
  CV_OVERVIEW_IDS,
  MAX_CLAIMS,
  WORK_EXPERIENCE_IDS,
  facts,
  type Fact,
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
    'sollte sollten soll wo'
  ).split(' '),
);

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

/** Reviewed fact ids for a broad topic question, or undefined. */
export function topicFactIds(terms: string): readonly string[] | undefined {
  const matched = resolvedTopics(terms);
  if (!matched.length) return;
  if (matched.length === 1) return matched[0].ids;
  return [...new Set(matched.flatMap(({ ids }) => ids))].slice(0, MAX_CLAIMS);
}

/** The reviewed longer summary that follows a topic answer. */
export function topicLongerSummary(terms: string) {
  const matched = resolvedTopics(terms);
  return matched.length === 1 ? matched[0].longer : undefined;
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

/** Replaces chosen topic candidates with their reviewed facts. */
export function expandTopicMatches(matches: readonly Fact[]): Fact[] {
  const ids = matches.flatMap(({ id }) =>
    isTopicCandidate({ id })
      ? (topics.find((topic) => TOPIC_PREFIX + topic.id === id)?.ids ?? [])
      : [id],
  );
  return [...new Set(ids)]
    .slice(0, MAX_CLAIMS)
    .flatMap((id) => facts.filter((fact) => fact.id === id));
}
