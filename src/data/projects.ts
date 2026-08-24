import type { Project } from '../lib/projects';
import { REPO_URL } from './site';

export const PROJECTS: readonly Project[] = [
  {
    slug: 'spotify-stats-tracker',
    name: 'SpotifyStatsTracker',
    tagline: {
      en: 'Self-hosted Spotify listening stats — no Premium required.',
      de: 'Selbst gehostete Spotify-Hörstatistiken — ganz ohne Premium.',
    },
    description: {
      en: 'Tracks and visualizes my listening history on my own server, similar to Your_Spotify but without the Premium requirement.',
      de: 'Erfasst und visualisiert meinen Hörverlauf auf dem eigenen Server — ähnlich wie Your_Spotify, aber ohne Premium-Pflicht.',
    },
    tech: ['Python', 'Self-hosted'],
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
      en: 'The Tutto card game as a modern web app.',
      de: 'Das Kartenspiel Tutto als moderne Web-App.',
    },
    description: {
      en: 'A digital version of the push-your-luck card game Tutto, built with TypeScript to play with friends.',
      de: 'Eine digitale Version des Kartenspiels Tutto, mit TypeScript gebaut, um mit Freunden zu spielen.',
    },
    tech: ['TypeScript'],
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
      de: 'Statischer Astro-Build pro Sprache, ausgeliefert per Content-Negotiation in nginx — als Docker-Image aus GitHub Actions, self-hosted im Homelab.',
    },
    tech: ['Astro', 'TypeScript', 'Docker', 'nginx'],
    repo: REPO_URL,
    status: 'active',
    featured: false,
    order: 3,
  },
  {
    slug: 'myspeed',
    name: 'MySpeed',
    tagline: {
      en: 'Long-term internet speed monitoring in the homelab.',
      de: 'Langzeit-Monitoring der Internetgeschwindigkeit im Homelab.',
    },
    description: {
      en: 'A self-hosted speed test analyzer that measures my connection around the clock — running from my own fork.',
      de: 'Ein selbst gehosteter Speedtest-Analyzer, der meine Leitung rund um die Uhr misst — läuft aus meinem eigenen Fork.',
    },
    tech: ['JavaScript', 'Node.js'],
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
      en: 'The practical part of my bachelor thesis: a JavaScript front end talking to a Java REST service.',
      de: 'Der praktische Teil meiner Bachelorarbeit: ein JavaScript-Frontend, das mit einem Java-REST-Service spricht.',
    },
    tech: ['Java', 'JavaScript', 'REST'],
    repo: 'https://github.com/i7Gamer/BachelorThesisWEB',
    status: 'archived',
    featured: false,
    order: 5,
  },
];
