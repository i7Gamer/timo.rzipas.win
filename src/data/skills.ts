import type { Localized } from '../i18n';

export interface SkillGroup {
  title: Localized<string>;
  items: string[];
  evidence?: Array<{ href: string; text: Localized<string> }>;
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
      'Flask',
    ],
    evidence: [
      {
        href: '/about/#abacus',
        text: {
          en: 'Java in daily ERP development at Abacus',
          de: 'Java im Berufsalltag bei Abacus',
        },
      },
      {
        href: '/projects/tutto/',
        text: {
          en: 'TypeScript and React in Tutto',
          de: 'TypeScript und React in Tutto',
        },
      },
      {
        href: '/projects/myspeed/',
        text: {
          en: 'Feature development and localization in MySpeed',
          de: 'Funktionsentwicklung und Übersetzungen in MySpeed',
        },
      },
      {
        href: '/projects/carini-management-system/',
        text: {
          en: 'Technical design and documentation at Carini',
          de: 'Technischer Entwurf und Dokumentation bei Carini',
        },
      },
    ],
  },
  {
    title: { en: 'Databases', de: 'Datenbanken' },
    items: ['SQLite', 'MySQL', 'MS-SQL', 'Oracle', 'MongoDB', 'NoSQL'],
    evidence: [
      {
        href: '/projects/spotify-stats-tracker/',
        text: {
          en: 'SQLite for multi-user listening history',
          de: 'SQLite für die Hörverläufe mehrerer Nutzer',
        },
      },
      {
        href: '/about/#stadler-internships',
        text: {
          en: 'SQL-backed tools at Stadler',
          de: 'SQL-gestützte Werkzeuge bei Stadler',
        },
      },
    ],
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
    evidence: [
      {
        href: '/projects/this-website/',
        text: {
          en: 'Docker, nginx and GitHub Actions for this site',
          de: 'Docker, nginx und GitHub Actions für diese Website',
        },
      },
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
