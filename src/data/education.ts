import type { Localized } from '../i18n';
import type { YearMonth } from '../lib/dates';

export interface Education {
  school: string;
  url?: string;
  degree: Localized<string>;
  from: YearMonth;
  to: YearMonth;
}

export const EDUCATION: readonly Education[] = [
  {
    school: 'FH Vorarlberg',
    url: 'https://www.fhv.at',
    degree: {
      en: 'BSc Software and Information Engineering',
      de: 'BSc Software and Information Engineering',
    },
    from: { year: 2016 },
    to: { year: 2018 },
  },
  {
    school: 'HTL Dornbirn',
    url: 'https://www.htldornbirn.at',
    degree: {
      en: 'Industrial engineering with a focus on computer science (Matura)',
      de: 'Wirtschaftsingenieurwesen mit Schwerpunkt Betriebsinformatik (Matura)',
    },
    from: { year: 2010 },
    to: { year: 2015 },
  },
];
