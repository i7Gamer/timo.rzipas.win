import { PROJECT_AI_NOTES } from '../../data/project-ai';
import type { Locale } from '../../i18n';
import {
  facts,
  MAX_CLAIMS,
  normalize,
  outOfScope,
  PET_SOURCE_PATH,
  sourceLink,
} from './catalog';
import { languageQuestion, moreQuestion } from './conversation';
import {
  approvedAnswer,
  asksAboutAICoding,
  asksAboutOtherCats,
  asksUnsupportedDetail,
  hasPetSubject,
  modelOverviewIds,
  needsDatedWorkEvidence,
  PET_DETAIL_IDS,
  profileQuestionNote,
  reviewedFactId,
} from './reviewed-questions';
import type { LocalPets } from './local-pets';
import { answerPets } from './pets';
import { editDistance } from './spelling';

export const SITE_CONTENT_PATH = '/ask-content.json';
const MAX_EXCERPT_LENGTH = 420;
const DUPLICATE_OVERLAP = 0.8;
const HOME_PAGE_PENALTY = 2;
const WEBSITE_PAGE = '/projects/this-website/';
const HOMELAB_PAGE = '/homelab/';
const HEARTHCOIL_PAGE = '/projects/hearthcoil/';
const SPOTIFY_PAGE = '/projects/spotify-stats-tracker/';
const TUTTO_PAGE = '/projects/tutto/';
const CARINI_PAGE = '/projects/carini-management-system/';
const stackFactIds: Partial<Record<string, string>> = {
  [SPOTIFY_PAGE]: 'spotify-python',
  [TUTTO_PAGE]: 'tutto-stack',
  '/projects/myspeed/': 'myspeed-stack',
};
const overviewFacts: Partial<
  Record<string, { id: string; evidence: RegExp[] }>
> = {
  [SPOTIFY_PAGE]: {
    id: 'spotify-accounts',
    evidence: [
      /multiple users|several people|mehrere nutzer/,
      /self hosted|selbst gehostet/,
      /(?:listening|spotify) history|hoerverlauf/,
    ],
  },
  [TUTTO_PAGE]: {
    id: 'tutto-modes',
    evidence: [
      /local play|lokales spiel/,
      /online rooms|online spielraeume/,
      /dice|wuerfel/,
      /computer opponents|computergegner/,
    ],
  },
  [HEARTHCOIL_PAGE]: {
    id: 'hearthcoil-game',
    evidence: [
      /one to four|ein bis vier/,
      /couch (?:co op|koop)/,
      /unity/,
      /gauntlet slayer edition/,
    ],
  },
};
const publicPath = /^\/(?:[a-z0-9-]+\/)*$/;

export interface SitePage {
  href: string;
  title: string;
  overview: string[];
  sections: { heading: string; paragraphs: string[] }[];
}

export interface SiteContent {
  locale: Locale;
  pages: SitePage[];
  localPets?: LocalPets;
}

export interface SiteExcerpt {
  href: string;
  title: string;
  excerpts: string[];
}

export interface SiteAnswer {
  preferModel?: true;
  status: 'answer' | 'partial' | 'unknown';
  sources: SiteExcerpt[];
  missing: string[];
  subjects?: SiteSubject[];
  note?: string;
  lead?: string;
  localOnly?: true;
}

export interface SiteSubject {
  href: string;
  heading?: string;
  label: string;
  catFactId?: (typeof PET_DETAIL_IDS)[number];
}

export function petSubject(
  locale: Locale,
  ids: readonly string[],
): SiteSubject {
  const catFactId =
    ids.length === 1 ? PET_DETAIL_IDS.find((id) => id === ids[0]) : undefined;
  return {
    href: PET_SOURCE_PATH,
    label: locale === 'de' ? 'Haustiere' : 'Pets',
    ...(catFactId ? { catFactId } : {}),
  };
}

interface Passage {
  page: SitePage;
  heading?: string;
  text: string;
  words: Set<string>;
}

export function parseSiteContent(
  value: unknown,
  locale: Locale,
): SiteContent | null {
  if (!value || typeof value !== 'object') return null;
  const index = value as SiteContent;
  if (
    index.locale !== locale ||
    !Array.isArray(index.pages) ||
    !index.pages.every(
      (page) =>
        page &&
        typeof page.href === 'string' &&
        publicPath.test(page.href) &&
        typeof page.title === 'string' &&
        Array.isArray(page.overview) &&
        page.overview.every((text) => typeof text === 'string') &&
        Array.isArray(page.sections) &&
        page.sections.every(
          (section) =>
            section &&
            typeof section.heading === 'string' &&
            Array.isArray(section.paragraphs) &&
            section.paragraphs.every((text) => typeof text === 'string'),
        ),
    )
  )
    return null;
  return { locale: index.locale, pages: index.pages };
}

const overviewQuestion =
  /^(?:(?:can|could|would) you |(?:(?:was )?kannst|koenntest) du )?(?:(?:tell me (?:more )?about|what (?:is|does)|show me|give me an overview of|erzaehl mir (?:mehr )?(?:ueber|vom?)|mir (?:mehr )?(?:ueber|vom?)|was (?:ist|macht)|wie sieht) )?(?:the |your |dein |der |die |das )?(.+?)(?: (?:bitte|please|erzaehlen|aus|do))?$/;

const stopWords = new Set(
  (
    'a about an and are at be can could did do does for from have help how i in is it its keeps me more much of on or played please s tell the their they this timo to use used using was what when where which who with would you your ' +
    'auf aus bei bitte bleiben das dein dem den der deren dessen die du ein eine er es erzaehl fuer gibt hat hast helfen hilfe ich ihr ihre ihrem ihren ihrer im in ist kann kannst man mehr mit mir nutzt oder sein seine seinem seinen seiner sie spielen timo ueber und verwendet viel vom von vor war wann was welche welcher welchem wer werden wie wieso wird wo womit zu zum zur'
  ).split(' '),
);

const nextClause =
  /,?\s+(?:and|und|sowie)\s+(?=(?:how|what|which|where|who|when|why|is|does|built|hosted|deployed|wie|was|wer|welch\p{L}*|wo|wann|warum|auf welchem|gebaut|betrieben|gehostet|ausgeliefert)\b)/iu;

function searchTerms(input: string) {
  return new Set(
    normalize(input)
      .replace(/\b(?:home lab)\b/g, 'homelab')
      .replace(/\bhomelab\b/g, 'homelab home')
      .replace(/\b(?:at home|zu hause|living room|wohnzimmer)\b/g, 'home')
      .replace(/\b(?:memory|arbeitsspeicher)\b/g, 'ram')
      .replace(/\b(?:graphics card|grafikkarte)\b/g, 'gpu')
      .replace(/\b(?:processor|prozessor)\b/g, 'cpu')
      .replace(
        /\b(?:dev server|development server|entwicklungsserver)\b/g,
        'devserver',
      )
      .replace(/\b(?:monitoring|monitors|ueberwach\w*)\b/g, 'monitor')
      .replace(/\b(?:sync|synchroniz\w*|synchron(?:isiert\w*)?)\b/g, 'sync')
      .replace(/\b(?:rooms?|spielraeume?n?)\b/g, 'room')
      .replace(/\b(?:works? on|working on|woran arbeitet)\b/g, '')
      .replace(/\b(?:what i built|meine umsetzung|mein beitrag)\b/g, 'build')
      .replace(/\b(?:welchem system|which system|operating system)\b/g, 'os')
      .replace(
        /\b(?:built|builds?|bauen|baut|gebaut|erstellt|erzeugt|packaged|packages|technologies|technologien|tech stack)\b/g,
        'build',
      )
      .replace(
        /\b(?:this site|this website|the site|the website|diese seite|diese website|die website)\b/g,
        'website',
      )
      .replace(
        /\b(?:running services|laufende dienste|self host(?:ed|ing)?|betreib\w* du selbst)\b/g,
        'selfhost hosting',
      )
      .replace(
        /\b(?:run|runs|running|hosts?|hosted|serves?|served|laeuft|laufen|hostet|gehostet|betrieben|deployed|ausgeliefert)\b/g,
        'hosting',
      )
      .split(' ')
      .filter((word) => word && !stopWords.has(word)),
  );
}

function excerpt(text: string) {
  if (text.length <= MAX_EXCERPT_LENGTH) return text;
  return text.slice(0, MAX_EXCERPT_LENGTH).replace(/\s+\S*$/, '') + '…';
}

function pageNames(page: SitePage) {
  return [
    normalize(page.title),
    normalize(page.href.split('/').at(-2) ?? ''),
    ...(page.href === WEBSITE_PAGE
      ? ['website', 'this site', 'the site', 'diese seite']
      : []),
    ...(page.href === CARINI_PAGE ? ['carini'] : []),
    ...(page.href === SPOTIFY_PAGE ? ['spotify', 'spotify tracker'] : []),
  ].filter(Boolean);
}

function overviewExcerpts(page: SitePage) {
  return page.overview.length
    ? page.overview
    : page.sections
        .flatMap(({ paragraphs }) => paragraphs)
        .filter((text) => /[.!?]$/.test(text));
}

function overviewLead(page: SitePage, locale: Locale) {
  const spec = overviewFacts[page.href];
  const visible = normalize(
    page.sections
      .flatMap(({ paragraphs }) => paragraphs)
      .concat(page.overview)
      .join(' '),
  );
  if (spec && spec.evidence.every((pattern) => pattern.test(visible))) {
    const fact = facts.find(({ id }) => id === spec.id);
    return (fact?.lead ?? fact?.answer)?.[locale];
  }
  if (
    page.href === HOMELAB_PAGE &&
    /self built server|server i built|selbst gebaute[rmn]? server/.test(
      visible,
    ) &&
    /monitoring|ueberwachung/.test(visible) &&
    /local language model|lokale sprachmodelle?/.test(visible)
  )
    return locale === 'de'
      ? 'Timo betreibt dieses Portfolio auf einem selbst gebauten Server. In seinem Homelab laufen auch Monitoring-Werkzeuge und lokale Sprachmodelle.'
      : 'Timo runs this portfolio on a server he built. His homelab also runs monitoring tools and local language models.';
}

function namedOverview(question: string, pages: SitePage[]) {
  const subject =
    /^(?:(?:can|could|would) you )?help (?:me )?(?:understand|with) (.+)$/.exec(
      question,
    )?.[1] ??
    /^(?:kannst|koenntest) du (?:mir )?(?:bitte )?bei (.+) helfen$/.exec(
      question,
    )?.[1] ??
    overviewQuestion.exec(question)?.[1];
  return subject
    ? pages.find((page) => pageNames(page).includes(subject))
    : undefined;
}

function cite(page: SitePage, paragraphs: string[], anchor = ''): SiteExcerpt {
  return {
    href: page.href + anchor,
    title: page.title,
    excerpts: paragraphs.map(excerpt),
  };
}

const aiUsageQuestion = [
  /^(?:ai|ki|artificial intelligence|kuenstliche intelligenz)$/,
  /^(?:(?:use|usage) of ai|ai (?:use|usage)|tell me about (?:your|timo s|his) use of ai)$/,
  /^(?:(?:how|when) (?:does (?:timo|he)|do you) use ai|what (?:does (?:timo|he)|do you) use ai for|(?:does (?:timo|he)|do you) use ai)$/,
  /^(?:(?:what|which) ai (?:tools|assistants) (?:does (?:timo|he)|do you|did (?:timo|you|he)) use|welche ki (?:werkzeuge|assistenten) nutzt (?:timo|du|er))$/,
  /^(?:ki nutzung|einsatz von ki|ki einsatz|(?:wie|wofuer) (?:nutzt (?:timo|du|er) ki|setzt (?:timo|du|er) ki ein)|nutzt (?:timo|du|er) ki)$/,
];
const selfHostingQuestion =
  /^(?:does (?:timo|he) self host|do you self host|does (?:timo|he) host (?:this|his|the) (?:website|site|portfolio)(?: himself)?|hostet (?:timo|er) (?:diese|seine|die) (?:website|seite) selbst|hostest du (?:diese|deine|die) (?:website|seite) selbst)$/;
const motionCapture = /\b(?:motion captur\w*|mocap)\b/;
const profileQuestion =
  /^(?:(?:who is|tell me about|wer ist|erzaehl mir (?:von|ueber)) timo(?: rzipa)?|what (?:kind of )?work does timo do|what does timo do(?: for a living)?|was macht timo beruflich)$/;
const spokenLanguageQuestion =
  /^(?:(?:what|which) (?:spoken )?languages (?:does (?:timo|he) speak|do you speak)|welche sprachen spricht (?:timo|er)|welche sprachen sprichst du)$/;
const programmingLanguageQuestion =
  /^(?:(?:what|which) programming languages (?:does (?:timo|he) use|do you use)|welche programmiersprachen (?:nutzt (?:timo|er)|nutzt du|verwendet (?:timo|er)))$/;
const abacusRoleQuestion =
  /^(?:(?:what (?:does timo|do you) (?:do|work on)|what does he do) at abacus|was macht (?:timo|er) bei abacus|was machst du bei abacus|woran arbeitet timo bei abacus)$/;
const stackQuestion =
  /^(?:tech ?stack|technology stack|what (?:tech )?stack(?: powers| does use)?|technologie ?stack|welcher tech ?stack(?: laeuft dahinter)?)$/;
const databaseQuestion =
  /^(?:(?:what|which) (?:kind of )?database(?: does(?: it)? use| is it built on)?|welche datenbank(?: nutzt(?: es)?| verwendet(?: es)?)?)$/;

function aiUsageOverview(pages: SitePage[], locale: Locale): SiteAnswer | null {
  const sources: SiteExcerpt[] = [];
  const subjects: SiteSubject[] = [];
  const homelab = pages.find(({ href }) => href === HOMELAB_PAGE);
  if (homelab) {
    const passages = homelab.sections
      .filter(({ heading }) =>
        /^(?:local llm|lokales sprachmodell|open webui)$/.test(
          normalize(heading.split(' › ').at(-1) ?? ''),
        ),
      )
      .flatMap(({ paragraphs }) => paragraphs.slice(0, 1));
    if (passages.length) {
      sources.push(cite(homelab, passages));
      subjects.push(subjectOf(homelab));
    }
  }
  const hearthcoil = pages.find(({ href }) => href === HEARTHCOIL_PAGE);
  const agentWork = PROJECT_AI_NOTES.hearthcoil?.development[locale];
  if (hearthcoil && agentWork) {
    sources.push(cite(hearthcoil, [agentWork]));
    subjects.push(subjectOf(hearthcoil));
  }
  return sources.length
    ? {
        status: 'answer',
        sources,
        missing: [],
        subjects,
        lead:
          sources.length === 2
            ? locale === 'de'
              ? 'Timo nutzt Claude Code und Codex für Entwicklung und Reviews an Hearthcoil. In seinem Homelab nutzt er lokale Sprachmodelle über Open WebUI.'
              : 'Timo uses Claude Code and Codex to build and review Hearthcoil changes. He also uses local language models through Open WebUI in his homelab.'
            : undefined,
      }
    : null;
}

function mentionPages(question: string, pages: readonly SitePage[]) {
  return pages.filter(
    (page) =>
      page.href !== '/' &&
      pageNames(page).some((name) =>
        (' ' + question + ' ').includes(' ' + name + ' '),
      ),
  );
}

function projectAiAnswer(
  question: string,
  normalized: string,
  pages: SitePage[],
  locale: Locale,
  subject?: SiteSubject,
): SiteAnswer | null {
  if (
    !/\b(?:ai|ki|llm|artificial intelligence|kuenstliche intelligenz|claude(?: code)?|codex|ask otto|sprachmodell)\b/.test(
      normalized,
    )
  )
    return null;
  const mentioned = mentionPages(normalized, pages);
  const asksAboutEarlierProjects =
    /\b(?:older projects?|earlier projects?|aelteren? projekte[n]?)\b/.test(
      normalized,
    );
  const topics = mentioned.length
    ? mentioned
    : pages.filter(
        ({ href }) =>
          href === subject?.href ||
          (href === TUTTO_PAGE && /\bask otto\b/.test(normalized)),
      );
  const documented = topics.flatMap((page) => {
    const slug = /^\/projects\/([^/]+)\/$/.exec(page.href)?.[1];
    const note = slug ? PROJECT_AI_NOTES[slug] : undefined;
    return note ? [{ page, note }] : [];
  });

  const asksForAmount =
    /%/.test(question) ||
    /\b(?:percent(?:age)?|prozent|anteil|how much (?:of|ai)|wie viel (?:davon|vom|ki))\b/.test(
      normalized,
    );
  if (asksForAmount) {
    if (
      !/\b(?:wrote|writ\w*|rewrit\w*|code|coded|built|generated|develop\w*|geschrieben|entwickelt|assist\w*|unterstuetzt|beteiligt|how much ai|wie viel ki)\b/.test(
        normalized,
      )
    )
      return null;
    return {
      status: 'unknown',
      sources: documented
        .slice(0, MAX_CLAIMS)
        .map(({ page }) => cite(page, [])),
      missing: [],
      note:
        locale === 'de'
          ? 'Dazu gibt es keinen verifizierten Prozentwert.'
          : 'I don’t have a verified percentage for how much AI wrote.',
    };
  }

  const product =
    /\b(?:product|produkt|gameplay|enemies|gegn(?:er|ern)|im spiel|im produkt|in the game|in the app|chatbot|powers?|ask otto)\b/.test(
      normalized,
    );
  const development =
    asksAboutEarlierProjects ||
    asksAboutAICoding(normalized) ||
    /\b(?:develop\w*|entwick\w*|built|bauen|gebaut|implement\w*|improv\w*|verbess\w*|fix\w*|korrig\w*|mainten\w*|code|coded|write|wrote|original|claude|codex)\b/.test(
      normalized,
    );
  const aboutPerson = /\b(?:timo|you|he|du|er)\b/.test(normalized);
  const asksIfUsed =
    /\b(?:ai (?:was )?(?:used|involved)|ki\b.*\b(?:eingesetzt|verwendet|genutzt))\b/.test(
      normalized,
    );
  if (asksAboutEarlierProjects && !topics.length)
    return {
      status: 'unknown',
      sources: [],
      missing: [],
      note:
        locale === 'de'
          ? 'Welches frühere Projekt meinst du?'
          : 'Which earlier project do you mean?',
    };
  const undocumented = documented.length === 1 ? documented[0].note : undefined;
  if (
    undocumented?.developmentUndocumented &&
    !product &&
    (development || aboutPerson || asksIfUsed)
  )
    return {
      status: 'unknown',
      sources: [],
      missing: [],
      note: undocumented.development[locale],
    };
  const sources: SiteExcerpt[] = [];
  const subjects: SiteSubject[] = [];
  let remaining = MAX_CLAIMS;
  for (const { page, note } of documented) {
    if (!remaining) break;
    const includeDevelopment =
      !note.developmentUndocumented && (development || !product);
    const passages = [
      ...(includeDevelopment ? [note.development[locale]] : []),
      ...(product || (!development && !aboutPerson)
        ? [note.product[locale]]
        : []),
    ].slice(0, remaining);
    if (!passages.length) continue;
    sources.push(cite(page, passages));
    if (includeDevelopment)
      for (const { href, label } of note.commits ?? [])
        sources.push({ href, title: label[locale], excerpts: [] });
    subjects.push(subjectOf(page));
    remaining -= passages.length;
  }
  return sources.length
    ? { status: 'answer', sources, missing: [], subjects }
    : null;
}

const MIN_FUZZY_LENGTH = 5;
const TWO_EDITS_MIN_LENGTH = 8;

export function resolveSiteNames(
  question: string,
  index: SiteContent,
  preferred?: string,
) {
  const alternatives = new Set<string>();
  if (outOfScope.test(normalize(question)))
    return { question, alternatives: [] };
  const names = index.pages.flatMap(({ href, title }) => {
    const name = normalize(title);
    return ((href.startsWith('/projects/') && href !== '/projects/') ||
      href === HOMELAB_PAGE) &&
      name.length >= MIN_FUZZY_LENGTH &&
      /^[a-z]+$/.test(name)
      ? [{ name, title }]
      : [];
  });
  if (
    /\btracker\b/.test(normalize(question)) &&
    index.pages.some(({ href }) => href === SPOTIFY_PAGE)
  )
    names.push({ name: 'spotify', title: 'Spotify' });
  const corrected = question.replace(/\p{L}+/gu, (word) => {
    const token = normalize(word);
    if (
      token.length < MIN_FUZZY_LENGTH ||
      names.some(({ name }) => name === token)
    )
      return word;
    const candidates = names
      .flatMap(({ name, title }) => {
        const limit =
          name === 'spotify' || name.length >= TWO_EDITS_MIN_LENGTH ? 2 : 1;
        if (
          token[0] !== name[0] ||
          Math.abs(token.length - name.length) > limit
        )
          return [];
        const distance = editDistance(token, name);
        return distance <= limit ? [{ title, distance }] : [];
      })
      .sort((a, b) => a.distance - b.distance);
    if (!candidates.length) return word;
    const closest = candidates.filter(
      ({ distance }) => distance === candidates[0].distance,
    );
    if (closest.length === 1) return closest[0].title;
    const selected = closest.find(({ title }) => title === preferred);
    if (selected) return selected.title;
    for (const { title } of closest) alternatives.add(title);
    return word;
  });
  return { question: corrected, alternatives: [...alternatives] };
}

export function namesSiteSubject(question: string, index: SiteContent) {
  const text = normalize(question);
  const terms = searchTerms(question);
  return (
    hasPetSubject(text) ||
    (index.localPets &&
      answerPets(text, index.locale, index.localPets) !== null) ||
    mentionPages(text, index.pages).length > 0 ||
    index.pages.some(({ sections }) =>
      sections.some(({ heading }) => {
        if (!heading.includes(' › ')) return false;
        const entity = searchTerms(heading.split(' › ').at(-1) ?? '');
        return entity.size > 0 && [...entity].every((term) => terms.has(term));
      }),
    )
  );
}

function subjectOf(page: SitePage, heading?: string): SiteSubject {
  if (heading?.includes(' › ')) {
    return {
      href: page.href,
      heading,
      label: heading.split(' › ').at(-1) ?? page.title,
    };
  }
  return { href: page.href, label: page.title };
}

function overlap(a: ReadonlySet<string>, b: ReadonlySet<string>) {
  let count = 0;
  for (const term of a) if (b.has(term)) count++;
  return count;
}

function rankPassages(
  question: string,
  pages: SitePage[],
  preferred?: SitePage,
  subjectHeading?: string,
): Passage[] {
  const terms = searchTerms(question);
  if (terms.has('os')) terms.delete('hosting');
  if (![...terms].some((term) => /\p{L}/u.test(term))) return [];
  const phrasing = normalize(question);
  const asksHow = /\b(?:how|wie|what keeps)\b/.test(phrasing);
  const asksDate =
    /^(?:when|wann|seit wann|since when|what year|in welchem jahr)\b/.test(
      phrasing,
    );
  const asksAmount = /^(?:how (?:much|many)|wie viel(?:e)?)\b/.test(phrasing);
  const asksHost =
    /^(?:who|which (?:company|(?:hosting )?provider)|wer|welcher anbieter)\b/.test(
      phrasing,
    ) && terms.has('hosting');
  const asksHostingLocation =
    /^(?:where|wo)\b/.test(phrasing) && terms.has('hosting');
  return pages
    .flatMap((page) => {
      const names = searchTerms(pageNames(page).join(' '));
      return page.sections.flatMap(({ heading, paragraphs }) => {
        if (subjectHeading && heading !== subjectHeading) return [];
        const context = new Set([...names, ...searchTerms(heading)]);
        const technical =
          /\b(?:engineering decisions|technische entscheidungen)\b/.test(
            normalize(heading),
          );
        return paragraphs.flatMap((text, position) => {
          if (/^[←→]|→$/u.test(text)) return [];
          if (asksDate && !/\b(?:19|20)\d{2}\b/.test(text)) return [];
          if (asksAmount && !/\d/.test(text)) return [];
          if (
            asksHostingLocation &&
            !/\b(?:at home|living room|homelab|zu hause|wohnzimmer|on a server i built)\b/i.test(
              text,
            )
          )
            return [];
          if (
            asksHost &&
            !/\b(?:hosted by|hosting provider|gehostet von|hostinganbieter)\b/i.test(
              text,
            )
          )
            return [];
          const words = searchTerms(text);
          const direct = overlap(terms, words);
          const contextual = overlap(terms, context);
          const covered = overlap(terms, new Set([...words, ...context]));
          if (covered < terms.size || (!direct && position !== 0)) return [];
          return [
            {
              page,
              heading,
              text,
              words,
              score:
                direct * 2 +
                contextual +
                Number(asksHow && technical) +
                Number(page === preferred) -
                (page.href === '/' ? HOME_PAGE_PENALTY : 0),
            },
          ];
        });
      });
    })
    .sort((a, b) => b.score - a.score);
}

export function findSiteContent(
  question: string,
  index: SiteContent,
  kind: 'overview' | 'related' = 'related',
  subject?: SiteSubject,
): SiteAnswer | null {
  const normalized = normalize(question).replace(/\bhome lab\b/g, 'homelab');
  if (outOfScope.test(normalized)) return null;
  const profileNote = profileQuestionNote(normalized, index.locale);
  if (profileNote)
    return { status: 'unknown', sources: [], missing: [], note: profileNote };
  const contextualQuestion =
    subject?.href === PET_SOURCE_PATH ? normalized + ' pets' : normalized;
  const modelIds = modelOverviewIds(contextualQuestion);
  const otherCats =
    subject?.href === PET_SOURCE_PATH && asksAboutOtherCats(normalized);
  if (otherCats && !subject?.catFactId)
    return {
      status: 'unknown',
      sources: [],
      missing: [],
      subjects: subject ? [subject] : [],
      note:
        index.locale === 'de'
          ? 'Welche Katze meinst du bereits?'
          : 'Which cat should I leave out?',
    };
  const approved =
    (otherCats
      ? {
          ids: PET_DETAIL_IDS.filter((id) => id !== subject?.catFactId),
          partial: undefined,
        }
      : undefined) ??
    approvedAnswer(normalized) ??
    (contextualQuestion !== normalized
      ? approvedAnswer(contextualQuestion)
      : undefined) ??
    (modelIds ? { ids: modelIds, partial: undefined } : undefined);
  if (
    (kind === 'overview' || subject) &&
    (approved ||
      nextClause.test(question) ||
      !asksUnsupportedDetail(contextualQuestion))
  ) {
    const ids = approved?.ids ?? [reviewedFactId(normalized)];
    const matched = ids.flatMap((id) => {
      const fact = facts.find((entry) => entry.id === id);
      if (!fact) return [];
      const source = sourceLink(fact.sourceId, index.locale);
      const page = index.pages.find(
        ({ href }) => href === source.href.split('#')[0],
      );
      return page ||
        source.href === PET_SOURCE_PATH ||
        source.href.startsWith('/downloads/') ||
        source.href.startsWith('https://github.com/')
        ? [{ fact, source, page }]
        : [];
    });
    if (matched.length) {
      const single = matched.length === 1;
      const sources = new Map<string, SiteExcerpt>();
      const subjects = new Map<string, SiteSubject>();
      for (const { fact, source, page } of matched) {
        const citation = sources.get(source.href) ?? {
          href: source.href,
          title: source.label,
          excerpts: [],
        };
        if (!single) citation.excerpts.push(fact.answer[index.locale]);
        sources.set(source.href, citation);
        if (page) subjects.set(page.href, subjectOf(page));
      }
      const petIds = matched
        .filter(({ source }) => source.href === PET_SOURCE_PATH)
        .map(({ fact }) => fact.id);
      if (petIds.length)
        subjects.set(PET_SOURCE_PATH, petSubject(index.locale, petIds));
      return {
        status:
          approved?.partial ||
          matched.length < ids.length ||
          matched.some(({ fact }) => fact.partial)
            ? 'partial'
            : 'answer',
        ...(modelIds ? { preferModel: true } : {}),
        sources: [...sources.values()],
        subjects: [...subjects.values()],
        missing: [],
        lead: single ? matched[0].fact.answer[index.locale] : undefined,
      };
    }
  }
  if (needsDatedWorkEvidence(normalized))
    return {
      status: 'unknown',
      sources: [],
      missing: [],
      note:
        index.locale === 'de'
          ? 'Mir fehlt ein datierter öffentlicher Stand dazu, woran Timo gerade arbeitet.'
          : 'I don’t have a dated public update on what Timo is working on now.',
    };
  if (!nextClause.test(question) && asksUnsupportedDetail(contextualQuestion))
    return null;
  const pets =
    index.localPets &&
    (kind === 'overview' || subject) &&
    answerPets(normalized, index.locale, index.localPets, subject);
  if (pets) return pets;
  const rememberedPage =
    subject &&
    index.pages.find(
      ({ href, sections }) =>
        href === subject.href &&
        (!subject.heading ||
          sections.some(({ heading }) => heading === subject.heading)),
    );
  if (subject && !rememberedPage) return null;
  const pages = rememberedPage ? [rememberedPage] : index.pages;
  const scope = mentionPages(normalized, pages);
  const target = scope.length === 1 ? scope[0] : rememberedPage;
  if (target) {
    const project = ' ' + normalized + ' ';
    const phrase = pageNames(target)
      .sort((first, second) => second.length - first.length)
      .reduce((text, name) => text.replace(' ' + name + ' ', ' '), project)
      .trim();
    let factId: string | undefined;
    if (
      languageQuestion.test(phrase) ||
      stackQuestion.test(phrase) ||
      (target.href === SPOTIFY_PAGE && databaseQuestion.test(phrase))
    )
      factId = stackFactIds[target.href];
    else if (
      target.href === SPOTIFY_PAGE &&
      /^(?:how does(?: it)? (?:avoid|prevent) duplicate plays|wie (?:vermeidet|verhindert)(?: es)? doppelte wiedergaben)$/.test(
        phrase,
      )
    )
      factId = 'spotify-reconciliation-example';
    else if (
      target.href === TUTTO_PAGE &&
      /^(?:(?:the|der|die) )?(?:strategy coach|strategie ?coach|spielhilfe)$/.test(
        phrase,
      )
    )
      factId = 'tutto-coach';
    const fact = factId && facts.find(({ id }) => id === factId);
    if (fact)
      return {
        status: 'answer',
        sources: [cite(target, [fact.answer[index.locale]])],
        missing: [],
        subjects: [subjectOf(target)],
        lead:
          fact.id === 'spotify-python' && databaseQuestion.test(phrase)
            ? index.locale === 'de'
              ? 'SpotifyTracker speichert den Hörverlauf in SQLite.'
              : 'SpotifyTracker uses SQLite to store listening history.'
            : fact.lead?.[index.locale],
      };
    if (rememberedPage && moreQuestion.test(normalized)) {
      const details = target.sections
        .filter(({ heading }) =>
          /^(?:engineering decisions|technische entscheidungen|the result|das ergebnis)$/.test(
            normalize(heading),
          ),
        )
        .flatMap(({ paragraphs }) => paragraphs.slice(0, 1));
      if (details.length)
        return {
          status: 'answer',
          sources: [cite(target, details)],
          missing: [],
          subjects: [subjectOf(target)],
        };
    }
  }
  const attribution =
    (kind === 'overview' || subject) &&
    projectAiAnswer(question, normalized, pages, index.locale, subject);
  if (attribution) return attribution;
  if (
    motionCapture.test(normalized) &&
    (subject?.href === HEARTHCOIL_PAGE ||
      /\b(?:hearthcoil|attacks?|angriffe?)\b/.test(normalized))
  ) {
    const page = pages.find(({ href }) => href === HEARTHCOIL_PAGE);
    const footage = page?.sections
      .flatMap(({ paragraphs }) => paragraphs)
      .flatMap((paragraph) => paragraph.split(/(?<=[.!?])\s+/))
      .find((sentence) =>
        /\b(?:animation reference|animationsreferenz)\b/.test(
          normalize(sentence),
        ),
      );
    if (page && footage)
      return {
        status: 'partial',
        sources: [cite(page, [footage])],
        missing: [],
        subjects: [subjectOf(page)],
        note:
          index.locale === 'de'
            ? 'Für Motion Capture habe ich keine öffentliche Bestätigung.'
            : 'I don’t have public confirmation of motion capture.',
      };
  }
  if (kind === 'overview') {
    if (!subject && aiUsageQuestion.some((pattern) => pattern.test(normalized)))
      return aiUsageOverview(pages, index.locale);
    if (abacusRoleQuestion.test(normalized)) {
      const about = pages.find(({ href }) => href === '/about/');
      const role = about?.sections.find(({ heading }) =>
        /\babacus\b/.test(normalize(heading)),
      );
      const excerpts = role?.paragraphs
        .filter((text) => /vaadin/i.test(text))
        .slice(0, MAX_CLAIMS);
      const fact = facts.find(({ id }) => id === 'abacus-workflow');
      if (about && role && excerpts?.length && fact) {
        const source = sourceLink(fact.sourceId, index.locale);
        return {
          status: 'answer',
          sources: [{ href: source.href, title: source.label, excerpts }],
          subjects: [subjectOf(about, role.heading)],
          missing: [],
          lead: fact.answer[index.locale],
        };
      }
    }
    const languageClauses = normalized.split(/\s+(?:and|und)\s+/);
    if (
      languageClauses.length === 2 &&
      languageClauses.some((clause) => spokenLanguageQuestion.test(clause)) &&
      languageClauses.some((clause) => programmingLanguageQuestion.test(clause))
    ) {
      const about = pages.find(({ href }) => href === '/about/');
      const spoken = about?.sections.find(({ heading }) =>
        /^(?:languages|sprachen)$/.test(normalize(heading)),
      )?.paragraphs;
      const skills = about?.sections.find(({ heading }) =>
        /^skills (?:languages|sprachen)$/.test(normalize(heading)),
      )?.paragraphs;
      if (about && spoken?.length && skills?.length) {
        const usage = skills.findIndex((text) =>
          /^(?:where i used it|wo ich es eingesetzt habe)$/.test(
            normalize(text),
          ),
        );
        const programming = skills
          .slice(0, usage === -1 ? undefined : usage)
          .filter((text) => normalize(text) !== 'html css');
        if (programming.length) {
          const list = new Intl.ListFormat(index.locale);
          return {
            status: 'answer',
            sources: [cite(about, [...spoken, ...programming])],
            subjects: [subjectOf(about)],
            missing: [],
            lead:
              index.locale === 'de'
                ? `Timos Sprachkenntnisse: ${list.format(spoken)}. Als Programmiersprachen nennt sein Portfolio ${list.format(programming)}.`
                : `Timo’s spoken languages are ${list.format(spoken)}. His portfolio lists ${list.format(programming)} for programming.`,
          };
        }
      }
    }
    const asksSpokenLanguages = spokenLanguageQuestion.test(normalized);
    if (asksSpokenLanguages || profileQuestion.test(normalized)) {
      const about = pages.find(({ href }) => href === '/about/');
      const paragraphs = asksSpokenLanguages
        ? about?.sections.find(({ heading }) =>
            /^(?:languages|sprachen)$/.test(normalize(heading)),
          )?.paragraphs
        : about?.sections[0]?.paragraphs
            .find((text) => /[.!?]$/.test(text))
            ?.split(/(?<=[.!?])\s+/)
            .slice(0, 2);
      if (about && paragraphs?.length)
        return {
          status: 'answer',
          sources: [cite(about, paragraphs.slice(0, MAX_CLAIMS))],
          missing: [],
          subjects: [subjectOf(about)],
        };
    }
    if (selfHostingQuestion.test(normalized)) {
      const page = pages.find(({ href }) => href === HOMELAB_PAGE);
      if (page)
        return {
          status: 'answer',
          sources: [cite(page, [])],
          missing: [],
          subjects: [subjectOf(page)],
          note:
            index.locale === 'de'
              ? 'Timo betreibt dieses Portfolio im eigenen Homelab und nutzt es, um seine Anwendungen bereitzustellen und zu überwachen.'
              : 'Timo hosts this portfolio on his homelab and uses it to deploy and monitor his applications.',
        };
    }
    const named = namedOverview(normalized, pages);
    if (!named) return null;
    const passages = overviewExcerpts(named).slice(0, MAX_CLAIMS);
    return {
      status: passages.length ? 'answer' : 'unknown',
      sources: [cite(named, passages)],
      missing: [],
      subjects: passages.length ? [subjectOf(named)] : [],
      lead: overviewLead(named, index.locale),
    };
  }

  const comparisonTerms = searchTerms(normalized);
  for (const page of scope)
    for (const term of searchTerms(pageNames(page).join(' ')))
      comparisonTerms.delete(term);
  if (
    scope.length > 1 &&
    scope.length <= MAX_CLAIMS &&
    /\b(?:compar\w*|vergleich\w*|unterscheid\w*)\b/.test(normalized) &&
    [...comparisonTerms].every((term) =>
      /^(?:compar\w*|vergleich\w*|unterscheid\w*|sich|project|projekte?|technology|technik|purpose|zweck|between)$/.test(
        term,
      ),
    )
  ) {
    const technology =
      comparisonTerms.has('technology') || comparisonTerms.has('technik');
    const purpose =
      comparisonTerms.has('purpose') || comparisonTerms.has('zweck');
    const matchingHeading =
      technology && !purpose
        ? /\b(?:engineering decisions|technische entscheidungen)\b/
        : /\b(?:what i built|meine umsetzung|mein beitrag)\b/;
    const sources = scope.flatMap((page) => {
      const section = page.sections.find(({ heading }) =>
        matchingHeading.test(normalize(heading)),
      );
      const passage =
        (purpose && !technology ? undefined : section?.paragraphs[0]) ??
        overviewExcerpts(page)[0];
      return passage ? [cite(page, [passage])] : [];
    });
    if (sources.length === scope.length)
      return {
        status: 'answer',
        sources,
        missing: [],
        subjects: scope.map((page) => subjectOf(page)),
      };
  }
  const chosen = new Map<SitePage, string[]>();
  const used: ReturnType<typeof searchTerms>[] = [];
  const missing: string[] = [];
  const clauses = question.split(nextClause);
  const subjects = new Map<string, SiteSubject>();
  let last: Pick<Passage, 'page' | 'heading'> | undefined = rememberedPage
    ? { page: rememberedPage, heading: subject?.heading }
    : undefined;
  const carriedHeading = subject?.heading;
  for (const clause of clauses) {
    if (used.length >= MAX_CLAIMS) {
      missing.push(clause);
      continue;
    }
    const normalizedClause = normalize(clause);
    const overview =
      clauses.length > 1 ? namedOverview(normalizedClause, pages) : undefined;
    const overviewText = overview && overviewExcerpts(overview)[0];
    const focus = mentionPages(normalizedClause, pages);
    const refersBack = /\b(?:it|its|er|es|seine|sie|they)\b/.test(
      normalizedClause,
    );
    if (refersBack && !last && !focus.length && clause !== clauses[0]) {
      missing.push(clause);
      continue;
    }
    const siteHosting =
      clauses.length > 1 &&
      focus.every(
        ({ href }) => href === WEBSITE_PAGE || href === HOMELAB_PAGE,
      ) &&
      (focus.some(({ href }) => href === WEBSITE_PAGE) ||
        (!focus.length && last?.page.href === WEBSITE_PAGE)) &&
      searchTerms(clause).has('hosting');
    const preferred = focus[0] ?? last?.page;
    const subjectHeading =
      carriedHeading ??
      (!focus.length && refersBack && last?.heading?.includes(' › ')
        ? last.heading
        : undefined);
    const homelab =
      siteHosting && pages.find(({ href }) => href === HOMELAB_PAGE);
    const pool = homelab
      ? [homelab]
      : focus.length
        ? focus
        : refersBack && last
          ? [last.page]
          : pages;
    const rankingQuestion = siteHosting ? clause + ' website' : clause;
    const localHits =
      !focus.length && !siteHosting && last
        ? rankPassages(rankingQuestion, [last.page], undefined, subjectHeading)
        : [];
    const primaryHits =
      overview && overviewText
        ? [
            {
              page: overview,
              text: overviewText,
              words: searchTerms(overviewText),
            },
          ]
        : localHits.length
          ? localHits
          : rankPassages(rankingQuestion, pool, preferred, subjectHeading);
    const ranked =
      homelab && !primaryHits.length
        ? rankPassages(
            rankingQuestion,
            pages.filter(({ href }) => href === WEBSITE_PAGE),
          )
        : primaryHits;
    const match = ranked.find(
      ({ words }) =>
        !used.some(
          (previous) =>
            overlap(words, previous) >=
            Math.max(words.size, previous.size) * DUPLICATE_OVERLAP,
        ),
    );
    if (!match) {
      if (!ranked.length) missing.push(clause);
      continue;
    }
    const selected = chosen.get(match.page) ?? [];
    selected.push(match.text);
    chosen.set(match.page, selected);
    used.push(match.words);
    last = match;
    const found = subjectOf(match.page, match.heading);
    subjects.set(found.href + '#' + (found.heading ?? ''), found);
  }
  const suggested = rememberedPage ? [rememberedPage] : scope;
  if (!chosen.size && !suggested.length) return null;
  return {
    status: !chosen.size ? 'unknown' : missing.length ? 'partial' : 'answer',
    sources: chosen.size
      ? [...chosen].map(([page, paragraphs]) => cite(page, paragraphs))
      : suggested.slice(0, MAX_CLAIMS).map((page) => cite(page, [])),
    missing: chosen.size ? missing : [],
    subjects: [...subjects.values()],
  };
}
