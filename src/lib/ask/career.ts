import { facts, MAX_CLAIMS, normalize, type Fact } from './catalog.ts';
import type { ChatTurn } from './history.ts';
import {
  modelOverviewIds,
  moreQuestion,
  workDetails,
  WORK_EXPERIENCE_IDS,
} from './reviewed-questions.ts';

const otherRoles =
  /^(?:(?:(?:and |what about |any )?(?:other|different|earlier|previous|more|additional)|(?:what|which) (?:other|different|earlier|previous)) (?:work experience|experience|jobs?|roles?|positions?|internships?)(?: (?:did|has) (?:he|timo) (?:have|had))?|(?:und )?(?:andere|weitere|fruehere) (?:berufserfahrung(?:en)?|jobs?|stellen|praktika))$/;
const careerFacts = [
  'tutoring',
  'carini-dates',
  'early-stadler',
  ...WORK_EXPERIENCE_IDS,
].flatMap((id) => facts.filter((fact) => fact.id === id));
const workFacts = [
  ...careerFacts,
  ...[
    'abacus-tests',
    'abacus-jenkins',
    'abacus-reviews-tests',
    'carini-document-view',
    'carini-team',
  ].flatMap((id) => facts.filter((fact) => fact.id === id)),
];
const employerFacts = {
  abacus: [
    'abacus-workflow',
    'abacus-tests',
    'abacus-jenkins',
    'abacus-reviews-tests',
  ],
  stadler: ['stadler-vpn', 'stadler-plugins', 'early-stadler'],
  'stadler-rds': ['stadler-vpn'],
  'stadler-altenrhein': ['stadler-plugins', 'early-stadler'],
} as const;
type EmployerScope = keyof typeof employerFacts;
type CareerScope = 'career' | 'work' | EmployerScope;

export function isEmployerScope(
  scope: CareerScope | undefined,
): scope is EmployerScope {
  return scope !== undefined && Object.hasOwn(employerFacts, scope);
}

function includesFact(text: string, fact: Fact) {
  return Object.values(fact.answer).some((answer) =>
    text.includes(normalize(answer)),
  );
}

const acknowledgement =
  /^(?:thanks|thank you|danke|ok(?:ay)?|got it|nice|great|verstanden|gern)$/;

export function careerAnchorIndex(history: readonly ChatTurn[]) {
  return history.findLastIndex(({ question }) => {
    const terms = normalize(question);
    return (
      !moreQuestion.test(terms) &&
      !workDetails.test(terms) &&
      !acknowledgement.test(terms)
    );
  });
}

function namedEmployer(terms: string): EmployerScope | undefined {
  const abacus = /\babacus\b/.test(terms);
  const stadler = /\bstadler\b/.test(terms);
  if (abacus === stadler) return;
  if (abacus) return 'abacus';
  if (/\bstadler rds\b/.test(terms)) return 'stadler-rds';
  if (/\bstadler altenrhein\b/.test(terms)) return 'stadler-altenrhein';
  return 'stadler';
}

function factsForEmployer(scope: EmployerScope) {
  return employerFacts[scope].flatMap((id) =>
    facts.filter((fact) => fact.id === id),
  );
}

export function careerFollowUpScope(
  terms: string,
  history: readonly ChatTurn[],
): CareerScope | undefined {
  if (otherRoles.test(terms)) return 'career';
  if (!moreQuestion.test(terms) && !workDetails.test(terms)) return;
  const anchor = history[careerAnchorIndex(history)] ?? history.at(-1);
  if (!anchor) return;
  const anchorQuestion = normalize(anchor.question);
  if (otherRoles.test(anchorQuestion)) return 'career';
  const employer = namedEmployer(anchorQuestion);
  if (employer) {
    if (
      factsForEmployer(employer).some((fact) =>
        includesFact(normalize(anchor.answer), fact),
      )
    )
      return employer;
    return;
  }
  if (
    modelOverviewIds(anchorQuestion) === WORK_EXPERIENCE_IDS ||
    workDetails.test(anchorQuestion) ||
    careerFacts.some((fact) => includesFact(normalize(anchor.answer), fact))
  )
    return 'work';
}

export function careerCandidates(
  history: readonly ChatTurn[],
  scope: CareerScope,
) {
  const covered = history.map(({ answer }) => normalize(answer));
  const scopedFacts = isEmployerScope(scope)
    ? factsForEmployer(scope)
    : scope === 'work'
      ? workFacts
      : careerFacts;
  return scopedFacts
    .filter((fact) => !covered.some((previous) => includesFact(previous, fact)))
    .slice(0, MAX_CLAIMS);
}
