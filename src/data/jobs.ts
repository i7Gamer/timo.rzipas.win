import type { Localized } from '../i18n';
import type { YearMonth } from '../lib/dates';

export interface Job {
  id: string;
  periodLabel?: Localized<string>;
  highlights?: Localized<string>[];
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
    id: 'abacus',
    company: 'Abacus Research AG',
    url: 'https://www.abacus.ch',
    role: { en: 'Software Engineer', de: 'Software Engineer' },
    location: {
      en: 'Wittenbach SG, Switzerland',
      de: 'Wittenbach SG, Schweiz',
    },
    from: { year: 2019, month: 9 },
    summary: {
      en: 'Software development in the Debitoren/Kreditoren Belege Prozess team, working on document workflows for accounts receivable and payable.',
      de: 'Softwareentwicklung im Team Debitoren/Kreditoren Belege Prozess, mit Fokus auf die automatische Verarbeitung von Belegen.',
    },
    highlights: [
      {
        en: 'Develop and maintain automatic document processing in the ERP system.',
        de: 'Automatische Belegverarbeitung im ERP-System weiterentwickeln und warten.',
      },
      {
        en: 'Investigate and fix bugs, and maintain existing applications.',
        de: 'Fehler analysieren und beheben sowie bestehende Anwendungen pflegen.',
      },
      {
        en: 'Build new applications and features for accounts receivable and payable.',
        de: 'Neue Anwendungen und Funktionen für die Debitoren- und Kreditorenbuchhaltung entwickeln.',
      },
      {
        en: 'Work with other teams to integrate our features into their applications and bring features from other products into ours.',
        de: 'Mit anderen Teams zusammenarbeiten, um eigene Funktionen in deren Anwendungen einzubinden und Funktionen anderer Produkte in unsere Anwendungen zu integrieren.',
      },
    ],
    tech: ['Java', 'Vaadin'],
  },
  {
    id: 'stadler-rds',
    company: 'Stadler',
    url: 'https://www.stadlerrail.com',
    role: { en: 'Software Developer', de: 'Softwareentwickler' },
    location: { en: 'Bussnang, Switzerland', de: 'Bussnang, Schweiz' },
    from: { year: 2018, month: 10 },
    to: { year: 2019, month: 8 },
    summary: {
      en: 'Implemented new features and maintained RDS (Rail Data Services) in a small team.',
      de: 'RDS (Rail Data Services) in einem kleinen Team weiterentwickelt und gewartet.',
    },
    tech: ['Java', 'Angular', 'JavaScript'],
    highlights: [
      {
        en: 'Built a new Angular frontend to manage the VPN certificates used for communication between trains and RDS.',
        de: 'Ein neues Angular-Frontend zur Verwaltung der VPN-Zertifikate entwickelt, die für die Kommunikation zwischen den Zügen und RDS benötigt werden.',
      },
      {
        en: 'Worked across feature development, bug fixes and ongoing system maintenance.',
        de: 'Neue Funktionen umgesetzt, Fehler behoben und das bestehende System gewartet.',
      },
    ],
  },
  {
    id: 'tutoring',
    company: 'Code Base Camp',
    url: 'https://www.code-base.at/',
    role: { en: 'Tutor', de: 'Tutor' },
    location: { en: 'Dornbirn, Austria', de: 'Dornbirn, Österreich' },
    from: { year: 2017, month: 11 },
    to: { year: 2018, month: 8 },
    periodLabel: {
      en: 'Nov 2017–Feb 2018; Aug 2018',
      de: 'Nov. 2017–Feb. 2018; Aug. 2018',
    },
    summary: {
      en: 'Supported programming beginners at FH Vorarlberg: Module 3 from November 2017 to February 2018, and Module 1 in August 2018.',
      de: 'Programmiereinsteiger an der FH Vorarlberg betreut: Modul 3 von November 2017 bis Februar 2018 und Modul 1 im August 2018.',
    },
    tech: [],
  },
  {
    id: 'stadler-internships',
    company: 'Stadler Altenrhein AG',
    url: 'https://www.stadlerrail.com',
    role: {
      en: 'Software Engineering Intern (several placements)',
      de: 'Praktikant Softwareentwicklung (mehrere Einsätze)',
    },
    location: { en: 'Altenrhein, Switzerland', de: 'Altenrhein, Schweiz' },
    from: { year: 2015 },
    to: { year: 2018 },
    summary: {
      en: 'Recurring internships building C# tooling — Outlook and MindManager plug-ins that automated project workflows around MS SQL.',
      de: 'In mehreren Praktika C#-Werkzeuge entwickelt, darunter Outlook- und MindManager-Plug-ins zur Automatisierung von Projektabläufen mit MS SQL.',
    },
    tech: ['C#', 'MS-SQL'],
    highlights: [
      {
        en: 'Built MindManager and Outlook plug-ins using C# and SQL to share project data and make assigned tasks accessible.',
        de: 'MindManager- und Outlook-Plug-ins mit C# und SQL entwickelt, um Projektdaten gemeinsam zu nutzen und Aufgaben zugänglich zu machen.',
      },
      {
        en: 'Automated meeting and change-request administration, customer communication and Excel workflows around Projectplace.',
        de: 'Besprechungs- und Änderungsverwaltung, Kundenkommunikation und Excel-Abläufe rund um Projectplace automatisiert.',
      },
      {
        en: 'Extended data analysis and customizable charts; fixed bugs and optimized existing code.',
        de: 'Datenauswertung und anpassbare Diagramme erweitert, Fehler behoben und bestehenden Code optimiert.',
      },
    ],
  },
  {
    id: 'carini',
    company: 'Etiketten CARINI GmbH',
    url: 'https://www.carini.at/',
    role: { en: 'Intern', de: 'Praktikant' },
    location: { en: 'Lustenau, Austria', de: 'Lustenau, Österreich' },
    from: { year: 2014, month: 7 },
    to: { year: 2014, month: 9 },
    summary: {
      en: 'Internship at Carini. A separate team diploma project on a SharePoint intranet for quality management ran from August 2014 to February 2015.',
      de: 'Praktikum bei Carini. Unabhängig davon arbeitete ich von August 2014 bis Februar 2015 im Team an einer Diplomarbeit über ein SharePoint-Intranet für das Qualitätsmanagement.',
    },
    tech: ['SharePoint'],
  },
  {
    id: 'early-stadler',
    company: 'Stadler Altenrhein AG',
    url: 'https://www.stadlerrail.com',
    role: { en: 'Technical Intern', de: 'Technischer Praktikant' },
    location: { en: 'Altenrhein, Switzerland', de: 'Altenrhein, Schweiz' },
    from: { year: 2011 },
    to: { year: 2013 },
    periodLabel: {
      en: '2011 and 2013 · summer internships',
      de: '2011 und 2013 · Sommerpraktika',
    },
    summary: {
      en: 'Prepared technical specifications, reports and calculations, and entered product data into databases.',
      de: 'Technische Spezifikationen, Berichte und Berechnungen erstellt sowie Produktdaten in Datenbanken eingepflegt.',
    },
    tech: [],
  },
];
