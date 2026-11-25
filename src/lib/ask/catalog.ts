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
export const CLIENT_TIMEOUT = 10_000;
export const MAX_SUMMARY_LENGTH = 420;
export const outOfScope =
  /\b(?:ignore (?:all |previous |the )?instructions|system prompt|follow (?:this|the) link|https?|password|passwort|credentials|salary|gehalt|lohn|private (?:email|e mail|address|phone|repo)|privatadresse|privatnummer|privates repository|nach hause|private files|confidential|vertraulich)\b/;

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
  summary?: string;
  claims: { id: string; text: string; sourceId: SourceId }[];
  sources: { id: SourceId; label: string; href: string }[];
}

export function isPortfolioPageHref(href: string) {
  return /^\/(?:[a-z0-9-]+\/)*(?:#[a-z0-9-]+)?$/i.test(href);
}

export function isSummaryText(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_SUMMARY_LENGTH &&
    value === value.trim() &&
    !/[<>\p{C}]|\b(?:https?:\/\/|www\.)/iu.test(value)
  );
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
    claims.length > MAX_CLAIMS ||
    (status === 'unknown') !== (claims.length === 0) ||
    !Array.isArray(citations) ||
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
  if ('summary' in result) {
    if (
      mode !== 'local' ||
      status !== 'answer' ||
      !isSummaryText(result.summary)
    )
      return null;
    canonical.summary = result.summary;
  }
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
