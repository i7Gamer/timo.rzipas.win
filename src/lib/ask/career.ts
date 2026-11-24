import { facts, MAX_CLAIMS, normalize, type Fact } from './catalog.ts';
import type { ChatTurn } from './history.ts';
import {
  modelOverviewIds,
  moreQuestion,
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
const abacusFacts = facts.filter(
  ({ id }) => id === 'abacus-workflow' || id === 'abacus-tests',
);
type CareerScope = 'career' | 'abacus';

function includesFact(text: string, fact: Fact) {
  return Object.values(fact.answer).some((answer) =>
    text.includes(normalize(answer)),
  );
}

export function careerFollowUpScope(
  terms: string,
  history: readonly ChatTurn[],
): CareerScope | undefined {
  if (otherRoles.test(terms)) return 'career';
  const previous = history.at(-1);
  if (!previous || !moreQuestion.test(terms)) return;
  const anchor = history.findLast(
    ({ question }) => !moreQuestion.test(normalize(question)),
  );
  if (
    anchor &&
    /\babacus\b/.test(normalize(anchor.question)) &&
    abacusFacts.some((fact) => includesFact(normalize(anchor.answer), fact))
  )
    return 'abacus';
  const previousQuestion = normalize(previous.question);
  if (
    otherRoles.test(previousQuestion) ||
    modelOverviewIds(previousQuestion) === WORK_EXPERIENCE_IDS ||
    careerFacts.some((fact) => includesFact(normalize(previous.answer), fact))
  )
    return 'career';
}

export function careerCandidates(
  history: readonly ChatTurn[],
  scope: CareerScope,
) {
  const covered = history.map(({ answer }) => normalize(answer));
  return (scope === 'abacus' ? abacusFacts : careerFacts)
    .filter((fact) => !covered.some((previous) => includesFact(previous, fact)))
    .slice(0, MAX_CLAIMS);
}
