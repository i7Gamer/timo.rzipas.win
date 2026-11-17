import type { Localized } from '../i18n';

export interface Skill {
  name: string;
  /** Iconify id ("set:name"); see src/lib/icons.ts for the bundled sets. */
  icon: string;
}

export interface SkillGroup {
  title: Localized<string>;
  items: Skill[];
  evidence?: Array<{ href: string; text: Localized<string> }>;
}

export const SKILL_GROUPS: readonly SkillGroup[] = [
  {
    title: { en: 'Languages', de: 'Sprachen' },
    items: [
      { name: 'Java', icon: 'simple-icons:openjdk' },
      { name: 'C#', icon: 'simple-icons:csharp' },
      { name: 'TypeScript', icon: 'simple-icons:typescript' },
      { name: 'JavaScript', icon: 'simple-icons:javascript' },
      { name: 'Python', icon: 'simple-icons:python' },
      { name: 'SQL', icon: 'lucide:database' },
      { name: 'HTML & CSS', icon: 'simple-icons:html5' },
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
        href: '/projects/carini-management-system/',
        text: {
          en: 'Technical design and documentation at Carini',
          de: 'Technischer Entwurf und Dokumentation bei Carini',
        },
      },
    ],
  },
  {
    title: { en: 'Frameworks', de: 'Frameworks' },
    items: [
      { name: 'Angular', icon: 'simple-icons:angular' },
      { name: 'React', icon: 'simple-icons:react' },
      { name: 'Vue', icon: 'simple-icons:vuedotjs' },
      { name: 'Vaadin', icon: 'simple-icons:vaadin' },
      { name: 'Flask', icon: 'simple-icons:flask' },
    ],
    evidence: [
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
    ],
  },
  {
    title: { en: 'Data', de: 'Daten' },
    items: [
      { name: 'MySQL', icon: 'simple-icons:mysql' },
      { name: 'MS-SQL', icon: 'simple-icons:microsoftsqlserver' },
      { name: 'Oracle', icon: 'simple-icons:oracle' },
      { name: 'SQLite', icon: 'simple-icons:sqlite' },
      { name: 'MongoDB', icon: 'simple-icons:mongodb' },
    ],
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
    title: { en: 'Ops & tooling', de: 'Ops & Tooling' },
    items: [
      { name: 'Docker', icon: 'simple-icons:docker' },
      { name: 'Linux', icon: 'simple-icons:linux' },
      { name: 'Windows Server', icon: 'simple-icons:windows' },
      { name: 'nginx', icon: 'simple-icons:nginx' },
      { name: 'Git', icon: 'simple-icons:git' },
      { name: 'GitHub Actions', icon: 'simple-icons:githubactions' },
      { name: 'Grafana', icon: 'simple-icons:grafana' },
      { name: 'Networking', icon: 'lucide:network' },
      { name: 'Reverse proxy & TLS', icon: 'lucide:shield-check' },
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
