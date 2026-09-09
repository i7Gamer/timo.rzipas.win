import type { Project } from '../lib/projects';
import { REPO_URL } from './site';
import {
  SPOTIFY_STORY,
  MYSPEED_STORY,
  TUTTO_STORY,
  WEBSITE_STORY,
  CARINI_STORY,
} from './project-stories';

export const PROJECTS: readonly Project[] = [
  {
    slug: 'spotify-stats-tracker',
    name: 'SpotifyStatsTracker',
    tagline: {
      en: 'Self-hosted Spotify history for multiple users.',
      de: 'Spotify-Hörstatistiken für mehrere Nutzer, selbst gehostet.',
    },
    description: {
      en: 'A complete rewrite with push-based listening updates, recovery of missed plays through the Spotify API, and genre and biography data from Last.fm.',
      de: 'Komplett neu entwickelt: Der Tracker kann Wiedergaben per Push erfassen, fehlende Einträge über die Spotify-API ergänzen und Genre-Infos sowie Biografien von Last.fm laden.',
    },
    tech: ['Python', 'Flask', 'SQLite', 'JavaScript'],
    story: SPOTIFY_STORY,
    repo: 'https://github.com/i7Gamer/SpotifyStatsTracker',
    link: 'https://music.rzipas.win/',
    status: 'active',
    featured: true,
    order: 1,
  },
  {
    slug: 'tutto',
    name: 'Tutto',
    tagline: {
      en: 'Tutto with friends, on one device or online.',
      de: 'Tutto mit Freunden, an einem Gerät oder online.',
    },
    description: {
      en: 'A dice-and-card game with synchronized rooms, physical or digital dice, computer opponents and an optional strategy coach.',
      de: 'Das Würfel- und Kartenspiel mit synchronisierten Spielräumen, echten oder digitalen Würfeln, Computergegnern und optionaler Spielhilfe.',
    },
    tech: ['TypeScript', 'React', 'Socket.IO', 'SQLite'],
    story: TUTTO_STORY,
    repo: 'https://github.com/i7Gamer/Tutto',
    link: 'https://tutto.rzipas.win/',
    status: 'active',
    featured: true,
    order: 2,
  },
  {
    slug: 'this-website',
    name: 'timo.rzipas.win',
    tagline: {
      en: 'This site — one URL, two languages, served from the living room.',
      de: 'Diese Seite — eine URL, zwei Sprachen, ausgeliefert aus dem Wohnzimmer.',
    },
    description: {
      en: 'Static Astro build per language behind nginx content negotiation, shipped as a Docker image by GitHub Actions and self-hosted on the homelab.',
      de: 'Für jede Sprache ein statischer Astro-Build; nginx liefert die passende Version aus. GitHub Actions erstellt das Docker-Image für den Betrieb im eigenen Homelab.',
    },
    tech: ['Astro', 'TypeScript', 'Docker', 'nginx'],
    repo: REPO_URL,
    story: WEBSITE_STORY,
    status: 'active',
    featured: false,
    order: 3,
  },
  {
    slug: 'myspeed',
    name: 'MySpeed',
    tagline: {
      en: 'Speed tests across internet and local-network targets.',
      de: 'Geschwindigkeitstests für Internet und Heimnetz.',
    },
    description: {
      en: 'My extended MySpeed fork adds iperf3, multi-target testing, a redesigned interface, new color themes and broader language support.',
      de: 'Mein erweiterter MySpeed-Fork bietet iperf3, Tests gegen mehrere Ziele, eine neu gestaltete Oberfläche, neue Farbschemata und zusätzliche Sprachen.',
    },
    tech: ['JavaScript', 'React', 'Bun', 'SQLite'],
    story: MYSPEED_STORY,
    repo: 'https://github.com/i7Gamer/MySpeed',
    link: 'https://myspeed.rzipas.win/',
    status: 'active',
    fork: true,
    featured: true,
    order: 4,
  },
  {
    slug: 'bachelor-thesis',
    name: 'Bachelor thesis',
    tagline: {
      en: 'Web app with a Java REST backend (FH Vorarlberg, 2018).',
      de: 'Web-App mit Java-REST-Backend (FH Vorarlberg, 2018).',
    },
    description: {
      en: 'The practical part of my bachelor thesis: a JavaScript frontend talking to a Java REST service.',
      de: 'Der praktische Teil meiner Bachelorarbeit: ein JavaScript-Frontend, das mit einem Java-REST-Service spricht.',
    },
    tech: ['Java', 'JavaScript', 'REST'],
    repo: 'https://github.com/i7Gamer/BachelorThesisWEB',
    status: 'archived',
    featured: false,
    order: 5,
  },
  {
    slug: 'carini-management-system',
    name: 'Carini · SharePoint',
    tagline: {
      en: 'A SharePoint intranet for quality-management documents.',
      de: 'Ein SharePoint-Intranet für Dokumente im Qualitätsmanagement.',
    },
    description: {
      en: 'A team diploma project in which I carried out most of the technical design and implementation, and wrote nearly all technical thesis sections.',
      de: 'Eine gemeinsame Diplomarbeit, bei der ich den Großteil des technischen Entwurfs und der Umsetzung sowie nahezu alle technischen Kapitel übernommen habe.',
    },
    tech: ['SharePoint'],
    status: 'archived',
    featured: false,
    order: 6,
    story: CARINI_STORY,
  },
];
