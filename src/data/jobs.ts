import type { Localized } from '../i18n';
import type { YearMonth } from '../lib/dates';

export interface Job {
  company: string;
  url?: string;
  role: Localized<string>;
  location: Localized<string>;
  from: YearMonth;
  to?: YearMonth;
  summary: Localized<string>;
  tech: string[];
}

export const JOBS: readonly Job[] = [
  {
    company: 'Abacus Research AG',
    url: 'https://www.abacus.ch',
    role: { en: 'Software Engineer', de: 'Softwareentwickler' },
    location: {
      en: 'Wittenbach SG, Switzerland',
      de: 'Wittenbach SG, Schweiz',
    },
    from: { year: 2019, month: 9 },
    summary: {
      en: 'Building business software in Java for one of Switzerland’s leading ERP vendors.',
      de: 'Entwicklung von Business-Software in Java für einen der führenden Schweizer ERP-Hersteller.',
    },
    tech: ['Java', 'Vaadin'],
  },
  {
    company: 'Stadler',
    url: 'https://www.stadlerrail.com',
    role: { en: 'Software Developer', de: 'Softwareentwickler' },
    location: { en: 'Bussnang, Switzerland', de: 'Bussnang, Schweiz' },
    from: { year: 2018, month: 10 },
    to: { year: 2019, month: 8 },
    summary: {
      en: 'Implemented new features and maintained RDS (Rail Data Services) in a small team.',
      de: 'Neue Features und Wartung für RDS (Rail Data Services) in einem kleinen Team.',
    },
    tech: ['Java', 'Angular', 'JavaScript'],
  },
  {
    company: 'Code Base Camp',
    url: 'https://www.code-base.at/',
    role: { en: 'Tutor', de: 'Tutor' },
    location: { en: 'Dornbirn, Austria', de: 'Dornbirn, Österreich' },
    from: { year: 2017, month: 11 },
    to: { year: 2018, month: 8 },
    summary: {
      en: 'Tutored programming beginners in the Code Base Camp modules at FH Vorarlberg alongside my studies.',
      de: 'Programmiereinsteiger in den Code-Base-Camp-Modulen an der FH Vorarlberg betreut — parallel zum Studium.',
    },
    tech: [],
  },
  {
    company: 'Stadler Altenrhein AG',
    url: 'https://www.stadlerrail.com',
    role: {
      en: 'Software Engineering Intern (several summers)',
      de: 'Software-Praktikant (mehrere Sommer)',
    },
    location: { en: 'Altenrhein, Switzerland', de: 'Altenrhein, Schweiz' },
    from: { year: 2011 },
    to: { year: 2018 },
    summary: {
      en: 'Recurring internships building C# tooling — Outlook and MindManager plug-ins that automated project workflows around MS SQL.',
      de: 'Wiederkehrende Praktika: C#-Tooling wie Outlook- und MindManager-Plug-ins zur Automatisierung von Projektabläufen rund um MS SQL.',
    },
    tech: ['C#', 'MS-SQL'],
  },
];
