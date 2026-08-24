import type { Localized } from '../i18n';

export interface SkillGroup {
  title: Localized<string>;
  items: string[];
}

export const SKILL_GROUPS: readonly SkillGroup[] = [
  {
    title: { en: 'Programming', de: 'Programmierung' },
    items: [
      'Java',
      'C#',
      'TypeScript',
      'JavaScript',
      'Python',
      'SQL',
      'HTML & CSS',
      'Angular',
      'Vue',
      'React',
      'Vaadin',
    ],
  },
  {
    title: { en: 'Databases', de: 'Datenbanken' },
    items: ['MySQL', 'MS-SQL', 'Oracle', 'MongoDB', 'NoSQL'],
  },
  {
    title: { en: 'Ops & homelab', de: 'Ops & Homelab' },
    items: [
      'Docker',
      'Linux',
      'Windows Server',
      'nginx',
      'Reverse proxy & TLS',
      'Networking',
      'Git',
      'GitHub Actions',
      'Monitoring & Grafana',
    ],
  },
];

export interface SpokenLanguage {
  name: Localized<string>;
  level: Localized<string>;
}

export const SPOKEN_LANGUAGES: readonly SpokenLanguage[] = [
  {
    name: { en: 'German', de: 'Deutsch' },
    level: { en: 'native', de: 'Muttersprache' },
  },
  {
    name: { en: 'English', de: 'Englisch' },
    level: { en: 'C1 — Cambridge CAE', de: 'C1 — Cambridge CAE' },
  },
];
