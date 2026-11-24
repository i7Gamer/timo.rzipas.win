import type { Locale } from '../../i18n';
import type { LocalPets } from './local-pets';
import type { SiteAnswer, SiteSubject } from './site-content';

const ABOUT = '/about/';

export function answerPets(
  question: string,
  locale: Locale,
  pets: LocalPets,
  subject?: SiteSubject,
): SiteAnswer | null {
  const title = locale === 'de' ? 'Haustiere' : 'Pets';
  const { cats, overview } = pets;
  const name = cats.find(({ name }) =>
    (' ' + question + ' ').includes(' ' + name.toLowerCase() + ' '),
  );
  const aboutPets = /\b(?:pets?|cats?|katzen?|haustiere?)\b/.test(question);
  const context = subject?.href === ABOUT && subject.label === title;
  if (!name && !aboutPets && !context) return null;

  const subjects = [{ href: ABOUT, label: title }];
  if (
    /\b(?:photos?|pictures?|images?|fotos?|bild(?:er)?|videos?)\b/.test(
      question,
    )
  )
    return {
      status: 'unknown',
      sources: [],
      missing: [],
      localOnly: true,
      note:
        locale === 'de'
          ? 'Dazu gibt es hier kein öffentliches Foto.'
          : 'I don’t have a public photo to share.',
    };
  if (
    name?.unverifiedVariety &&
    /\b(?:exact|registered|variety|subtype|genau\w*|fellvariante|zuchttyp)\b/.test(
      question,
    )
  )
    return {
      status: 'unknown',
      sources: [],
      missing: [],
      localOnly: true,
      note:
        name.description[locale] +
        (locale === 'de'
          ? ' Seine genaue Fellvariante ist nicht verifiziert.'
          : ' His exact coat variety is unverified.'),
    };

  let note = overview[locale];
  if (name) note = name.description[locale];
  else if (
    /\b(?:breeds?|colou?rs?|coats?|rassen?|fell|farben?)\b/.test(question)
  )
    note = cats.map((cat) => cat.description[locale]).join(' ');
  else if (/\b(?:names?|called|heiss\w*|namen?)\b/.test(question)) {
    const names = new Intl.ListFormat(locale).format(
      cats.map(({ name }) => name),
    );
    note =
      locale === 'de' ? `Sie heissen ${names}.` : `They’re called ${names}.`;
  } else if (context && !aboutPets) return null;

  return {
    status: 'answer',
    sources: [],
    missing: [],
    subjects,
    note,
    localOnly: true,
  };
}
