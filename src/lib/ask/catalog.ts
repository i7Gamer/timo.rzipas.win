import data from '../../data/ask/facts.json' with { type: 'json' };
import type { Locale } from '../../i18n';

export type SourceId = keyof typeof data.sources;
export interface Fact {
  id: string;
  sourceId: SourceId;
  facet: string;
  aliases: readonly string[];
  standalone?: readonly string[];
  partial?: boolean;
  /** Answers only its own narrow question, e.g. “no master’s degree is listed”. */
  explicitOnly?: boolean;
  answer: Record<Locale, string>;
  lead?: Record<Locale, string>;
  evidence: readonly string[];
}

export const facts = data.facts as Fact[];
export const sources = data.sources;
export const examples = data.examples;
export const MAX_QUESTION = 500;
export const PET_SOURCE_PATH = '/ask-pets.txt';
export const MAX_CLAIMS = 3;
export const PROJECT_OVERVIEW_IDS = [
  'spotify-rewrite',
  'myspeed-fork',
  'tutto-modes',
] as const;
export const CV_OVERVIEW_IDS = [
  'career-role-titles',
  'cv-degree',
  'cv-matura',
] as const;
export const WORK_EXPERIENCE_IDS = [
  'abacus-workflow',
  'stadler-vpn',
  'stadler-plugins',
] as const;
export const EXTENDED_PITCH_IDS = [
  'portfolio-pitch',
  'career-role-titles',
  'carini-team',
  'hearthcoil-game',
  'hearthcoil-contribution',
  'spotify-rewrite',
  'homelab-motivation',
] as const;
export const expandedSummaries = {
  'longer summary of his cv': [
    ...CV_OVERVIEW_IDS,
    ...WORK_EXPERIENCE_IDS,
    'tutoring',
  ],
  'longer summary of his work experience': [
    ...WORK_EXPERIENCE_IDS,
    'tutoring',
    'early-stadler',
    'carini-team',
  ],
  'longer summary of his projects': [
    ...PROJECT_OVERVIEW_IDS,
    'hearthcoil-game',
    'bachelor-contribution',
    'carini-team',
    'portfolio-website-architecture',
  ],
  'longer summary of timo': [
    ...EXTENDED_PITCH_IDS,
    'portfolio-project-inventory',
    'abacus-workflow',
    'stadler-vpn',
  ],
} as const;
export const SUMMARY_WORD_TARGET = 200;
export const wordCountSummaries = {
  profile: EXTENDED_PITCH_IDS,
  cv: [
    ...expandedSummaries['longer summary of his cv'],
    'early-stadler',
    'carini-dates',
    'portfolio-spoken-languages',
  ],
  work: [
    'career-role-titles',
    ...expandedSummaries['longer summary of his work experience'],
    'abacus-jenkins',
    'carini-document-view',
  ],
  projects: [
    ...expandedSummaries['longer summary of his projects'],
    'myspeed-stack',
    'spotify-accounts',
  ],
  workAndProjects: [
    'career-role-titles',
    'abacus-workflow',
    'stadler-vpn',
    ...PROJECT_OVERVIEW_IDS,
    'hearthcoil-game',
    'bachelor-contribution',
    'portfolio-website-architecture',
  ],
} as const;
export const extendedPitchLead = {
  en: 'Here’s a pitch of about 200 words.',
  de: 'Hier ist ein Pitch mit rund 200 Wörtern.',
} as const;

function includesExactClaims(
  claims: readonly Pick<Fact, 'id'>[],
  ids: readonly string[],
) {
  return (
    claims.length === ids.length &&
    ids.every((id) => claims.some((claim) => claim?.id === id))
  );
}

export function hasExtendedPitchClaims(claims: readonly Pick<Fact, 'id'>[]) {
  return includesExactClaims(claims, EXTENDED_PITCH_IDS);
}

/** Most facts a long reviewed summary shows, as many as the extended pitch. */
export const LONG_SUMMARY_CLAIMS = EXTENDED_PITCH_IDS.length;
const PROJECTS_PREFIX = '/projects/';

/** The page a source links to, without its fragment. */
export function sourcePage(id: SourceId) {
  const { href } = sources[id];
  return (typeof href === 'string' ? href : href.en).split('#')[0];
}

/** General facts per project page, in catalogue order. */
export const projectFacts: Readonly<Record<string, readonly string[]>> =
  facts.reduce<Record<string, string[]>>((pages, fact) => {
    const page = sourcePage(fact.sourceId);
    if (
      !fact.explicitOnly &&
      page.startsWith(PROJECTS_PREFIX) &&
      page !== PROJECTS_PREFIX
    )
      (pages[page] ??= []).push(fact.id);
    return pages;
  }, {});

/** The reviewed long summary of one project page. */
export function longProjectSummary(page: string) {
  return (projectFacts[page] ?? []).slice(0, LONG_SUMMARY_CLAIMS);
}

function hasExtendedSummaryClaims(claims: readonly Pick<Fact, 'id'>[]) {
  return [
    ...Object.values(wordCountSummaries),
    ...Object.values(expandedSummaries),
    ...Object.keys(projectFacts).map(longProjectSummary),
  ].some((ids) => includesExactClaims(claims, ids));
}

export function summaryRequiresAllFacts(
  claims: readonly Pick<Fact, 'id' | 'sourceId'>[],
) {
  return (
    hasExtendedSummaryClaims(claims) ||
    claims.some(({ sourceId }) => sourceId === 'cv')
  );
}
export const CLIENT_TIMEOUT = 10_000;
export const outOfScope =
  /\b(?:ignore (?:all |previous |the )?instructions|system prompt|follow (?:this|the) link|https?|password|passwort|credentials|salary|gehalt|lohn|earnings|^(?!.*\b(?:degree|diploma|qualification|bachelor|master|matura|certificate|title)\b).*\bearn(?:s|ed|ing)?|income|compensation|wages?|(?:well |badly |under|over)?paid|pay (?:him|timo|you)|how much (?:does|do|did) (?:he|timo|you) make|verdien(?:t|st|en|e)?|einkommen|verguetung|bezahl(?:t|ung)|stundensatz|honorar|private (?:email|e mail|address|phone|repo)|privatadresse|privatnummer|privates repository|nach hause|private files|confidential|vertraulich)\b/;

export type AskStatus = 'answer' | 'partial' | 'unknown';
export type AskMode = 'local' | 'index';
export const missingDetails = {
  'cv-gaps': {
    en: 'The public CV does not establish whether there are any gaps. You can ask about a specific period.',
    de: 'Ob es Lücken gibt, geht aus dem öffentlichen Lebenslauf nicht hervor. Du kannst nach einem bestimmten Zeitraum fragen.',
  },
  'additional-question': {
    en: 'The sources support the answer above. The additional question is still unanswered.',
    de: 'Die Quellen stützen die Antwort oben. Die zusätzliche Frage bleibt offen.',
  },
} as const;
export type MissingDetail = keyof typeof missingDetails;
export interface AskResult {
  status: AskStatus;
  mode: AskMode;
  locale: Locale;
  corpusVersion: string;
  clarifyProject?: string;
  missing?: MissingDetail;
  claims: { id: string; text: string; sourceId: SourceId }[];
  sources: { id: SourceId; label: string; href: string }[];
}

export function isPortfolioPageHref(href: string) {
  return /^\/(?:[a-z0-9-]+\/)*(?:#[a-z0-9-]+)?$/i.test(href);
}

const reviewedHrefs = new Set(
  Object.values(sources).flatMap(({ href }) =>
    typeof href === 'string' ? [href] : Object.values(href),
  ),
);

/** Whether an href is exactly one the reviewed catalogue cites. */
export function isReviewedSourceHref(href: string) {
  return reviewedHrefs.has(href) || catalogDownload(href) !== undefined;
}

const DOWNLOADS_PREFIX = '/downloads/';
const PAGE_FRAGMENT = /^page=\d+$/;
const catalogFiles = new Set(
  Object.values(sources)
    .flatMap(({ href }) =>
      typeof href === 'string' ? [href] : Object.values(href),
    )
    .map((href) => href.split('#')[0])
    .filter((href) => href.startsWith(DOWNLOADS_PREFIX)),
);

/**
 * The reviewed catalogue file an href points to, or undefined. Only files the
 * catalogue cites qualify, optionally with a `#page=N` fragment.
 */
export function catalogDownload(href: string) {
  const hash = href.indexOf('#');
  const file = hash < 0 ? href : href.slice(0, hash);
  if (!catalogFiles.has(file)) return;
  if (hash >= 0 && !PAGE_FRAGMENT.test(href.slice(hash + 1))) return;
  return file;
}

export function sourceLink(id: SourceId, locale: Locale) {
  const { href, label } = sources[id];
  return {
    id,
    label: label[locale],
    href: typeof href === 'string' ? href : href[locale],
  };
}

export function documentAnswer(
  matches: readonly Fact[],
  status: AskStatus,
  mode: AskMode,
  locale: Locale,
  corpusVersion: string,
  missing?: MissingDetail,
): AskResult {
  return {
    status,
    mode,
    locale,
    corpusVersion,
    ...(missing ? { missing } : {}),
    claims: matches.map(({ id, answer, sourceId }) => ({
      id,
      text: answer[locale],
      sourceId,
    })),
    sources: [...new Set(matches.map(({ sourceId }) => sourceId))].map((id) =>
      sourceLink(id, locale),
    ),
  };
}

export function normalize(question: string) {
  return question
    .toLowerCase()
    .replaceAll('ß', 'ss')
    .replaceAll(/ä|ö|ü/g, (v) => ({ ä: 'ae', ö: 'oe', ü: 'ue' })[v] ?? v)
    .replaceAll('c#', 'c sharp')
    .normalize('NFKD')
    .replaceAll(/\p{M}/gu, '')
    .replaceAll(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function exampleMatch(question: string) {
  const terms = normalize(question);
  const example = examples.find(({ question }) =>
    Object.values(question).some((text) => normalize(text) === terms),
  );
  return facts.find(({ id }) => id === example?.factId);
}

export function validateResult(
  value: unknown,
  locale: Locale,
  version: string,
  activeFacts: readonly Fact[] = facts,
) {
  if (!value || typeof value !== 'object') return null;
  const result = value as AskResult;
  const { status, mode, claims, sources: citations } = result;
  if (
    result.locale !== locale ||
    result.corpusVersion !== version ||
    !['answer', 'partial', 'unknown'].includes(status) ||
    !['index', 'local'].includes(mode) ||
    !Array.isArray(claims) ||
    (claims.length > MAX_CLAIMS &&
      (status !== 'answer' || !hasExtendedSummaryClaims(claims))) ||
    (status === 'unknown') !== (claims.length === 0) ||
    !Array.isArray(citations) ||
    'summary' in result ||
    ('missing' in result &&
      (status !== 'partial' ||
        typeof result.missing !== 'string' ||
        !Object.hasOwn(missingDetails, result.missing)))
  )
    return null;

  const matches = new Map<string, Fact>();
  for (const claim of claims) {
    const fact = activeFacts.find(({ id }) => id === claim?.id);
    if (
      !fact ||
      matches.has(fact.id) ||
      claim.sourceId !== fact.sourceId ||
      claim.text !== fact.answer[locale] ||
      (fact.partial && status !== 'partial')
    )
      return null;
    matches.set(fact.id, fact);
  }
  const canonical = documentAnswer(
    [...matches.values()],
    status,
    mode,
    locale,
    version,
    result.missing,
  );
  if ('clarifyProject' in result) {
    const candidate = activeFacts.find(
      ({ id }) => id === result.clarifyProject,
    );
    if (
      !candidate ||
      mode !== 'local' ||
      status !== 'unknown' ||
      !sourceLink(candidate.sourceId, locale).href.startsWith('/projects/')
    )
      return null;
    canonical.clarifyProject = candidate.id;
  }
  if (
    citations.length !== canonical.sources.length ||
    !canonical.sources.every(
      ({ id, label, href }, index) =>
        citations[index]?.id === id &&
        citations[index].label === label &&
        citations[index].href === href,
    )
  )
    return null;
  return canonical;
}

export const catalogContent = JSON.stringify(data);
