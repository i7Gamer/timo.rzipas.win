import {
  facts,
  MAX_CLAIMS,
  normalize,
  PROJECT_OVERVIEW_IDS,
  sourceLink,
} from './catalog.ts';
import type { ChatTurn } from './history.ts';
import { moreQuestion, summaryOverviewIds } from './reviewed-questions.ts';

export const PROJECTS_PATH = '/projects/';
export const PROJECT_OVERVIEW_PATTERNS = [
  'projects|projekte',
  '(?:tell me about|show me|give me (?:an overview of|examples of)) (?:your |timo s |his |the )?projects',
  '(?:what|which)(?: (?:kinds|types) of)? projects (?:has timo (?:worked on|built)|have you (?:built|worked on)|did (?:timo|you) build)',
  'what are (?:your|timo s|his) projects',
  '(?:erzaehl mir von|zeig mir) (?:deinen |timos |seinen |die )?projekt(?:e|en)',
  'what have you built(?: so far)?',
  '(?:welche|was fuer) projekte (?:hat timo|hast du) (?:bisher )?(?:umgesetzt|gemacht|gebaut|entwickelt)',
  'welche projekte gibt es',
];
const projectOverview = new RegExp(
  '^(?:' + PROJECT_OVERVIEW_PATTERNS.join('|') + ')$',
);
const otherProjects =
  /^(?:(?:what |which |any |some )?(?:other|more|additional) projects(?: (?:has timo|have (?:you|they)|did (?:timo|you|he)) (?:work(?:ed)? on|build|built|make|made))?|(?:welche )?(?:andere|weitere) projekte(?: (?:hat timo|hast du) (?:umgesetzt|gebaut|entwickelt))?)$/;
const showcase = [
  { id: 'spotify-rewrite', label: 'SpotifyTracker', aliases: ['spotify'] },
  { id: 'myspeed-fork', label: 'MySpeed' },
  { id: 'tutto-modes', label: 'Tutto' },
  { id: 'hearthcoil-game', label: 'Hearthcoil' },
  {
    id: 'bachelor-contribution',
    label: 'Bachelor thesis',
    aliases: ['bachelorarbeit'],
  },
  { id: 'carini-team', label: 'CARINI' },
] as const;

export function projectChoice(id: string) {
  const project = showcase.find((entry) => entry.id === id);
  const fact = facts.find((entry) => entry.id === id);
  if (project && fact)
    return {
      id,
      label: project.label,
      href: sourceLink(fact.sourceId, 'en').href,
    };
}

function mentionedProjects(answer: string) {
  const text = ' ' + normalize(answer) + ' ';
  return showcase.filter((project) =>
    [project.label, ...('aliases' in project ? project.aliases : [])].some(
      (name) => text.includes(' ' + normalize(name) + ' '),
    ),
  );
}

export function projectFollowUp(terms: string, history: readonly ChatTurn[]) {
  if (otherProjects.test(terms)) return { listRequested: true as const };
  if (!moreQuestion.test(terms)) return;
  const root = history.findLast(
    ({ question }) =>
      otherProjects.test(normalize(question)) ||
      !moreQuestion.test(normalize(question)),
  );
  if (!root) return;
  const anchor = normalize(root.question);
  if (otherProjects.test(anchor)) return { preserveSubjects: true as const };
  if (summaryOverviewIds(anchor) === PROJECT_OVERVIEW_IDS)
    return { listRequested: true as const };
  const mentioned = mentionedProjects(root.answer);
  if (!projectOverview.test(anchor)) {
    const named = mentionedProjects(anchor);
    if (named.length === 1 && mentioned.some(({ id }) => id === named[0].id))
      return { overview: root, projectId: named[0].id };
    return;
  }
  return {
    overview: root,
    focus: mentioned.length === 1 ? projectChoice(mentioned[0].id) : undefined,
  };
}

export function projectCandidates(
  history: readonly ChatTurn[],
  projectId?: string,
) {
  const project = projectId && projectChoice(projectId);
  if (project) {
    const covered = history.map(({ answer }) => normalize(answer));
    return facts
      .filter(
        (fact) =>
          fact.id !== project.id &&
          sourceLink(fact.sourceId, 'en').href.split('#')[0] === project.href &&
          !Object.values(fact.answer).some((answer) =>
            covered.some((previous) => previous.includes(normalize(answer))),
          ),
      )
      .slice(0, MAX_CLAIMS);
  }
  const covered = new Set(
    history.flatMap(({ answer }) =>
      mentionedProjects(answer).map(({ id }) => id),
    ),
  );
  return showcase
    .flatMap(({ id }) =>
      !covered.has(id) ? facts.filter((fact) => fact.id === id) : [],
    )
    .slice(0, MAX_CLAIMS);
}
