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

function includesFact(text: string, fact: Fact) {
  return Object.values(fact.answer).some((answer) =>
    text.includes(normalize(answer)),
  );
}

export function isCareerFollowUp(terms: string, history: readonly ChatTurn[]) {
  if (otherRoles.test(terms)) return true;
  const previous = history.at(-1);
  if (!previous || !moreQuestion.test(terms)) return false;
  const previousQuestion = normalize(previous.question);
  const previousAnswer = normalize(previous.answer);
  return (
    otherRoles.test(previousQuestion) ||
    modelOverviewIds(previousQuestion) === WORK_EXPERIENCE_IDS ||
    careerFacts.some((fact) => includesFact(previousAnswer, fact))
  );
}

export function careerCandidates(history: readonly ChatTurn[]) {
  const covered = history.map(({ answer }) => normalize(answer));
  return careerFacts
    .filter((fact) => !covered.some((previous) => includesFact(previous, fact)))
    .slice(0, MAX_CLAIMS);
}
