import type { Localized } from '../i18n';
import type { YearMonth } from '../lib/dates';

export interface Education {
  id?: string;
  school: string;
  summary?: Localized<string>;
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
    id: 'htl-dornbirn',
    school: 'HTL Dornbirn',
    url: 'https://www.htldornbirn.at',
    summary: {
      en: 'In my second year at HTL Dornbirn, I built a website for my class. It had file sharing, a Facebook-style feed, live chat and a separate mobile view. I see it as an early precursor to my current homelab projects.',
      de: 'Im zweiten Jahr an der HTL Dornbirn baute ich eine Website für meine Klasse. Dort konnten wir Dateien teilen und live chatten. Ausserdem gab es einen Feed nach dem Vorbild von Facebook und eine eigene Ansicht fürs Handy. Für mich war die Website ein früher Vorläufer meiner heutigen Homelab-Projekte.',
    },
    degree: {
      en: 'Industrial engineering with a focus on computer science (Matura)',
      de: 'Wirtschaftsingenieurwesen mit Schwerpunkt Betriebsinformatik (Matura)',
    },
    from: { year: 2010 },
    to: { year: 2015 },
  },
];
