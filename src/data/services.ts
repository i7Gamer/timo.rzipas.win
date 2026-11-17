import type { Localized } from '../i18n';
import { STORAGE_TOTAL } from './hardware';

export type ServiceStatus = 'online' | 'planned';

export const SERVICE_GROUPS = [
  {
    id: 'mine',
    title: { en: 'Built by me', de: 'Selbst entwickelt' },
    // The only group open by default — the part most worth seeing.
    open: true,
  },
  {
    id: 'infrastructure',
    title: { en: 'Infrastructure', de: 'Infrastruktur' },
  },
  {
    id: 'monitoring',
    title: { en: 'Monitoring & operations', de: 'Monitoring & Betrieb' },
  },
  { id: 'ai', title: { en: 'Local AI', de: 'Lokale KI' } },
  { id: 'media', title: { en: 'Media library', de: 'Medienbibliothek' } },
  {
    id: 'automation',
    title: { en: 'Media automation', de: 'Medienautomatisierung' },
  },
  {
    id: 'everyday',
    title: { en: 'Everyday apps & games', de: 'Alltagsanwendungen & Spiele' },
  },
] as const satisfies ReadonlyArray<{
  id: string;
  title: Localized<string>;
  open?: boolean;
}>;

export type ServiceGroup = (typeof SERVICE_GROUPS)[number]['id'];

export interface Service {
  name: string;
  displayName?: Localized<string>;
  group: ServiceGroup;
  /** Links the service to its project story; only for things I built. */
  project?: { slug: string; role: 'own' | 'contributor' };
  description: Localized<string>;
  status: ServiceStatus;
}

export const SERVICES: readonly Service[] = [
  {
    name: 'timo.rzipas.win',
    group: 'mine',
    project: { slug: 'this-website', role: 'own' },
    description: {
      en: 'This website — nginx serving static Astro builds, one per language.',
      de: 'Diese Website — nginx liefert statische Astro-Builds aus, einen pro Sprache.',
    },
    status: 'online',
  },
  {
    name: 'Cloudflare Tunnel',
    group: 'infrastructure',
    description: {
      en: 'Publishes everything behind rzipas.win without opening a single port.',
      de: 'Veröffentlicht alles hinter rzipas.win, ohne einen einzigen Port zu öffnen.',
    },
    status: 'online',
  },
  {
    name: 'Bulk Storage',
    displayName: { en: 'Bulk Storage', de: 'Datenspeicher' },
    group: 'infrastructure',
    description: {
      en: `${STORAGE_TOTAL} of spinning disks for media, backups and experiments.`,
      de: `${STORAGE_TOTAL} Festplattenspeicher für Medien, Backups und Experimente.`,
    },
    status: 'online',
  },
  {
    name: 'Grafana',
    group: 'monitoring',
    description: {
      en: 'Dashboards for everything the homelab measures — load, temperatures, traffic.',
      de: 'Dashboards für alles, was das Homelab misst — Last, Temperaturen, Traffic.',
    },
    status: 'online',
  },
  {
    name: 'MySpeed',
    group: 'mine',
    project: { slug: 'myspeed', role: 'contributor' },
    description: {
      en: 'Around-the-clock internet speed history of my connection.',
      de: 'Regelmäßige Messungen zeigen, wie sich die Geschwindigkeit meiner Internetverbindung im Laufe der Zeit verändert.',
    },
    status: 'online',
  },
  {
    name: "What's up Docker",
    group: 'monitoring',
    description: {
      en: 'Watches every container image and tells me when an update is out.',
      de: 'Überwacht alle Container-Images und meldet, sobald ein Update da ist.',
    },
    status: 'online',
  },
  {
    name: 'Local LLM',
    displayName: { en: 'Local LLM', de: 'Lokales Sprachmodell' },
    group: 'ai',
    description: {
      en: 'Local language model inference — prompts never leave the house.',
      de: 'Lokale Sprachmodell-Inferenz — Prompts verlassen das Haus nicht.',
    },
    status: 'online',
  },
  {
    name: 'Open WebUI',
    group: 'ai',
    description: {
      en: 'Chat interface in front of the local models, reachable from every device.',
      de: 'Chat-Oberfläche für die lokalen Sprachmodelle, von jedem Gerät erreichbar.',
    },
    status: 'online',
  },
  {
    name: 'Plex',
    group: 'media',
    description: {
      en: 'Media server for the household — films, series and music off the bulk storage.',
      de: 'Medienserver für den Haushalt — Filme, Serien und Musik vom eigenen Speicher.',
    },
    status: 'online',
  },
  {
    name: 'Seerr',
    group: 'media',
    description: {
      en: 'Request and discovery frontend for the media library — the successor to Overseerr.',
      de: 'Filme und Serien entdecken und ihre Aufnahme in die Medienbibliothek anfragen — der Nachfolger von Overseerr.',
    },
    status: 'online',
  },
  {
    name: 'Tautulli',
    group: 'media',
    description: {
      en: 'Playback statistics and history for the Plex server.',
      de: 'Wiedergabestatistiken und Verlauf für den Plex-Server.',
    },
    status: 'online',
  },
  {
    name: 'Agregarr',
    group: 'media',
    description: {
      en: 'Keeps the Plex home screen fresh by rebuilding collections from Trakt, IMDb and friends.',
      de: 'Hält die Plex-Startseite frisch und baut Sammlungen aus Trakt, IMDb & Co. immer wieder neu auf.',
    },
    status: 'online',
  },
  {
    name: 'Sonarr',
    group: 'automation',
    description: {
      en: 'Keeps track of my series and files new episodes where they belong.',
      de: 'Behält meine Serien im Blick und legt neue Folgen dort ab, wo sie hingehören.',
    },
    status: 'online',
  },
  {
    name: 'Radarr',
    group: 'automation',
    description: {
      en: 'The same idea as Sonarr, applied to the film library.',
      de: 'Dasselbe Prinzip wie Sonarr, angewandt auf die Filmsammlung.',
    },
    status: 'online',
  },
  {
    name: 'Bazarr',
    group: 'automation',
    description: {
      en: 'Fetches subtitles for everything Sonarr and Radarr bring in.',
      de: 'Holt Untertitel für alles, was Sonarr und Radarr einsammeln.',
    },
    status: 'online',
  },
  {
    name: 'Jackett',
    group: 'automation',
    description: {
      en: 'Turns dozens of indexers into one API the *arr services can query.',
      de: 'Macht aus dutzenden Indexern eine API, die die *arr-Dienste abfragen können.',
    },
    status: 'online',
  },
  {
    name: 'FlareSolverr',
    group: 'automation',
    description: {
      en: 'Clears the bot checks that would otherwise block the indexer searches.',
      de: 'Löst die Bot-Prüfungen, die sonst die Indexer-Suchen blockieren würden.',
    },
    status: 'online',
  },
  {
    name: 'qBittorrent',
    group: 'automation',
    description: {
      en: 'The download client the automation stack hands its jobs to.',
      de: 'Der Download-Client, an den die Automatisierung ihre Aufträge übergibt.',
    },
    status: 'online',
  },
  {
    name: 'Mealie',
    group: 'everyday',
    description: {
      en: 'Recipe collection and weekly meal planning, self-hosted for the kitchen.',
      de: 'Rezeptsammlung und Wochenplanung — selbst gehostet für die Küche.',
    },
    status: 'online',
  },
  {
    name: 'Tutto',
    group: 'mine',
    project: { slug: 'tutto', role: 'own' },
    description: {
      en: 'My Tutto card game, hosted at home for game nights with friends.',
      de: 'Mein Kartenspiel Tutto, zu Hause gehostet für Spieleabende mit Freunden.',
    },
    status: 'online',
  },
  {
    name: 'SpotifyTracker',
    group: 'mine',
    project: { slug: 'spotify-stats-tracker', role: 'own' },
    description: {
      en: 'My own listening statistics, tracked without Spotify Premium.',
      de: 'Meine Hörstatistiken, erfasst ganz ohne Spotify Premium.',
    },
    status: 'online',
  },
];
