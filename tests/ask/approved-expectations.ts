import data from './approved-answers.json' with { type: 'json' };

export const approvedAnswers = data;

export function approvedExpectation(
  suite: string,
  { locale, question }: { locale: string; question: string },
) {
  return approvedAnswers.find(
    (fixture) =>
      fixture.baseline === suite &&
      fixture.locale === locale &&
      fixture.question === question,
  );
}
