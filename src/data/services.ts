import type { Localized } from '../i18n';
import { STORAGE_TOTAL } from './hardware';

export type ServiceStatus = 'online' | 'planned';

export interface Service {
  name: string;
  category: Localized<string>;
  description: Localized<string>;
  status: ServiceStatus;
}

export const SERVICES: readonly Service[] = [
  {
    name: 'timo.rzipas.win',
    category: { en: 'Web', de: 'Web' },
    description: {
      en: 'This website — nginx serving static Astro builds, one per language.',
      de: 'Diese Website — nginx liefert statische Astro-Builds aus, einen pro Sprache.',
    },
    status: 'online',
  },
  {
    name: 'Cloudflare Tunnel',
    category: { en: 'Network', de: 'Netzwerk' },
    description: {
      en: 'Publishes everything behind rzipas.win without opening a single port.',
      de: 'Veröffentlicht alles hinter rzipas.win, ohne einen einzigen Port zu öffnen.',
    },
    status: 'online',
  },
  {
    name: 'Bulk storage',
    category: { en: 'Data', de: 'Daten' },
    description: {
      en: `${STORAGE_TOTAL} of spinning disks for media, backups and experiments.`,
      de: `${STORAGE_TOTAL} rotierende Platten für Medien, Backups und Experimente.`,
    },
    status: 'online',
  },
  {
    name: 'Grafana',
    category: { en: 'Monitoring', de: 'Monitoring' },
    description: {
      en: 'Dashboards for everything the homelab measures — load, temperatures, traffic.',
      de: 'Dashboards für alles, was das Homelab misst — Last, Temperaturen, Traffic.',
    },
    status: 'online',
  },
  {
    name: 'MySpeed',
    category: { en: 'Monitoring', de: 'Monitoring' },
    description: {
      en: 'Around-the-clock internet speed history of my connection.',
      de: 'Rund-um-die-Uhr-Verlauf der Internetgeschwindigkeit meiner Leitung.',
    },
    status: 'online',
  },
  {
    name: "What's up Docker",
    category: { en: 'Ops', de: 'Ops' },
    description: {
      en: 'Watches every container image and tells me when an update is out.',
      de: 'Überwacht alle Container-Images und meldet, sobald ein Update da ist.',
    },
    status: 'online',
  },
  {
    name: 'Local LLM',
    category: { en: 'AI', de: 'KI' },
    description: {
      en: 'Local language model inference — prompts never leave the house.',
      de: 'Lokale Sprachmodell-Inferenz — Prompts verlassen das Haus nicht.',
    },
    status: 'online',
  },
  {
    name: 'Open WebUI',
    category: { en: 'AI', de: 'KI' },
    description: {
      en: 'Chat interface in front of the local models, reachable from every device.',
      de: 'Chat-Oberfläche vor den lokalen Modellen, von jedem Gerät erreichbar.',
    },
    status: 'online',
  },
  {
    name: 'Plex',
    category: { en: 'Media', de: 'Medien' },
    description: {
      en: 'Media server for the household — films, series and music off the bulk storage.',
      de: 'Medienserver für den Haushalt — Filme, Serien und Musik von den großen Platten.',
    },
    status: 'online',
  },
  {
    name: 'Seerr',
    category: { en: 'Media', de: 'Medien' },
    description: {
      en: 'Request and discovery frontend for the media library — the successor to Overseerr.',
      de: 'Wunsch- und Entdeckungs-Frontend für die Medienbibliothek — der Nachfolger von Overseerr.',
    },
    status: 'online',
  },
  {
    name: 'Tautulli',
    category: { en: 'Monitoring', de: 'Monitoring' },
    description: {
      en: 'Playback statistics and history for the Plex server.',
      de: 'Wiedergabestatistiken und Verlauf für den Plex-Server.',
    },
    status: 'online',
  },
  {
    name: 'Agregarr',
    category: { en: 'Media', de: 'Medien' },
    description: {
      en: 'Keeps the Plex home screen fresh by rebuilding collections from Trakt, IMDb and friends.',
      de: 'Hält die Plex-Startseite frisch und baut Sammlungen aus Trakt, IMDb & Co. immer wieder neu auf.',
    },
    status: 'online',
  },
  {
    name: 'Sonarr',
    category: { en: 'Automation', de: 'Automatisierung' },
    description: {
      en: 'Keeps track of my series and files new episodes where they belong.',
      de: 'Behält meine Serien im Blick und legt neue Folgen dort ab, wo sie hingehören.',
    },
    status: 'online',
  },
  {
    name: 'Radarr',
    category: { en: 'Automation', de: 'Automatisierung' },
    description: {
      en: 'The same idea as Sonarr, applied to the film library.',
      de: 'Dasselbe Prinzip wie Sonarr, angewandt auf die Filmsammlung.',
    },
    status: 'online',
  },
  {
    name: 'Bazarr',
    category: { en: 'Automation', de: 'Automatisierung' },
    description: {
      en: 'Fetches subtitles for everything Sonarr and Radarr bring in.',
      de: 'Holt Untertitel für alles, was Sonarr und Radarr einsammeln.',
    },
    status: 'online',
  },
  {
    name: 'Jackett',
    category: { en: 'Automation', de: 'Automatisierung' },
    description: {
      en: 'Turns dozens of indexers into one API the *arr services can query.',
      de: 'Macht aus dutzenden Indexern eine API, die die *arr-Dienste abfragen können.',
    },
    status: 'online',
  },
  {
    name: 'FlareSolverr',
    category: { en: 'Automation', de: 'Automatisierung' },
    description: {
      en: 'Clears the bot checks that would otherwise block the indexer searches.',
      de: 'Löst die Bot-Prüfungen, die sonst die Indexer-Suchen blockieren würden.',
    },
    status: 'online',
  },
  {
    name: 'qBittorrent',
    category: { en: 'Downloads', de: 'Downloads' },
    description: {
      en: 'The download client the automation stack hands its jobs to.',
      de: 'Der Download-Client, an den die Automatisierung ihre Aufträge übergibt.',
    },
    status: 'online',
  },
  {
    name: 'Mealie',
    category: { en: 'Home', de: 'Haushalt' },
    description: {
      en: 'Recipe collection and weekly meal planning, self-hosted for the kitchen.',
      de: 'Rezeptsammlung und Wochenplanung — selbst gehostet für die Küche.',
    },
    status: 'online',
  },
  {
    name: 'Tutto',
    category: { en: 'Games', de: 'Spiele' },
    description: {
      en: 'My Tutto card game, hosted at home for game nights with friends.',
      de: 'Mein Kartenspiel Tutto, zu Hause gehostet für Spieleabende mit Freunden.',
    },
    status: 'online',
  },
  {
    name: 'SpotifyStatsTracker',
    category: { en: 'Analytics', de: 'Statistik' },
    description: {
      en: 'My own listening statistics, tracked without Spotify Premium.',
      de: 'Meine Hörstatistiken, erfasst ganz ohne Spotify Premium.',
    },
    status: 'online',
  },
];
