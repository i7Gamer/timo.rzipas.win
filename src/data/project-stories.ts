import spotifyGenres from '../assets/projects/spotify-genres.png';
import spotifyCompare from '../assets/projects/spotify-compare.png';
import myspeedStatistics from '../assets/projects/myspeed-statistics.png';
import myspeedComparison from '../assets/projects/myspeed-target-comparison.png';
import type { ProjectStoryContent } from '../lib/projects';

export const SPOTIFY_STORY: ProjectStoryContent = {
  problem: {
    en: 'I wanted several people to keep their Spotify listening history on one self-hosted instance, with useful statistics and a way to recover plays missed while offline or during interruptions.',
    de: 'Ich wollte, dass mehrere Nutzer ihren Spotify-Hörverlauf auf einer selbst gehosteten Instanz erfassen können – mit aussagekräftigen Statistiken und einer Möglichkeit, verpasste Wiedergaben nach Offline-Hören oder Ausfällen nachzutragen.',
  },
  contribution: {
    en: 'I rewrote the application, database layer and interface using Python, Flask and SQLite. Each account has its own history, settings and listener. A shared music catalog avoids duplicating track and artist information. Users can choose to share statistics and compare their listening habits. Last.fm adds genre information and artist and album biographies.',
    de: 'Ich habe Anwendung, Datenbankzugriff und Oberfläche mit Python, Flask und SQLite neu entwickelt. Jedes Konto hat einen eigenen Hörverlauf, eigene Einstellungen und einen eigenen Listener. Titel und Künstler liegen in einem gemeinsamen Musikkatalog. Wer möchte, kann Statistiken teilen und Hörgewohnheiten vergleichen. Last.fm ergänzt Genre-Informationen sowie Künstler- und Albumbiografien.',
  },
  decisions: {
    en: 'The listener can receive Spotify Connect updates over a WebSocket. Push mode is optional and falls back to polling when the connection becomes unreliable. A separate process uses the Spotify API to backfill recently played tracks; reconciliation prevents live updates and backfill from counting the same play twice. Server-rendered pages use JavaScript and htmx for interaction.',
    de: 'Der Listener kann Änderungen an der Wiedergabe über eine WebSocket-Verbindung zu Spotify Connect empfangen. Dieser Push-Modus ist optional; bei Verbindungsproblemen greift der Listener auf Polling zurück. Ein separater Prozess trägt kürzlich gehörte Titel über die Spotify-API nach. Ein Abgleich verhindert doppelte Einträge aus Live-Erfassung und Nachträgen. Serverseitig gerenderte Seiten werden durch JavaScript und htmx ergänzt.',
  },
  outcome: {
    en: 'The result supports multiple users, genre insights, annual summaries and comparisons on a compact self-hosted setup. With working Spotify API authorization, backfill can recover missed plays that Spotify still exposes in its recent history. It cannot reconstruct arbitrarily long outages. Last.fm enriches the catalog; listening recovery comes from Spotify.',
    de: 'Entstanden ist eine selbst gehostete Anwendung für mehrere Nutzer mit Genre-Auswertungen, Jahresrückblicken und Vergleichen. Mit gültigem Spotify-API-Zugang können verpasste Wiedergaben nachgetragen werden, solange Spotify sie noch im jüngsten Hörverlauf bereitstellt. Beliebig lange Ausfälle lassen sich damit nicht rekonstruieren. Last.fm liefert die Zusatzinformationen; fehlende Wiedergaben kommen über Spotify.',
  },
  provenance: {
    en: 'The project began as a fork of TzurSoffer/SpotifyStatsTracker. I subsequently rewrote the application code, database layer and interface.',
    de: 'Das Projekt begann als Fork von TzurSoffer/SpotifyStatsTracker. Anwendungscode, Datenbankzugriff und Oberfläche habe ich anschließend neu entwickelt.',
  },
  upstream: 'https://github.com/TzurSoffer/SpotifyStatsTracker',
  images: [
    {
      image: spotifyGenres,
      alt: {
        en: 'Spotify Stats Tracker genre distribution and listening trends.',
        de: 'Genre-Verteilung und Hörverlauf in Spotify Stats Tracker.',
      },
      caption: {
        en: 'Genre insights enriched with Last.fm data.',
        de: 'Genre-Auswertungen mit Daten von Last.fm.',
      },
    },
    {
      image: spotifyCompare,
      alt: {
        en: 'Listening comparison between two accounts.',
        de: 'Vergleich der Hörstatistiken zweier Konten.',
      },
      caption: {
        en: 'Shared listening statistics, with account names redacted in the original screenshot.',
        de: 'Geteilte Hörstatistiken; die Kontonamen sind bereits im Originalbild unkenntlich gemacht.',
      },
    },
  ],
};

export const MYSPEED_STORY: ProjectStoryContent = {
  problem: {
    en: 'I wanted to compare internet connections and local-network paths in the same application, and see how each target changes over time.',
    de: 'Ich wollte Internetverbindungen und Verbindungen im lokalen Netzwerk in derselben Anwendung vergleichen und ihre Entwicklung über längere Zeit verfolgen.',
  },
  contribution: {
    en: 'My substantially extended fork adds iperf3 alongside Ookla, LibreSpeed and Cloudflare, with individually configurable targets and test settings. I redesigned the overview and statistics pages around target filters, comparisons and changes over time. New languages and translation corrections accompany the interface overhaul.',
    de: 'Mein deutlich erweiterter Fork ergänzt Ookla, LibreSpeed und Cloudflare um iperf3. Testziele und Messparameter lassen sich einzeln konfigurieren. Übersicht und Statistikseiten habe ich neu gestaltet, mit Filtern für Testziele, Vergleichen und Veränderungen gegenüber früheren Zeiträumen. Weitere Sprachen und korrigierte Übersetzungen ergänzen die Überarbeitung.',
  },
  decisions: {
    en: 'Each round measures its targets in sequence so the tests do not compete for bandwidth. Light, dark and system modes work independently of the Slate, Nord, Carbon and Ember palettes. The React frontend uses Chart.js and talks to an Express backend running on Bun or Node.js. SQLite keeps the default installation compact; MySQL is also supported.',
    de: 'Pro Durchlauf werden die Ziele nacheinander gemessen, damit sich die Tests nicht gegenseitig Bandbreite wegnehmen. Heller und dunkler Modus sowie die automatische Anpassung an das System lassen sich mit den Farbschemata Slate, Nord, Carbon und Ember kombinieren. Die React-Oberfläche nutzt Chart.js und ein Express-Backend auf Bun oder Node.js. Standardmäßig speichert SQLite die Daten; MySQL wird ebenfalls unterstützt.',
  },
  outcome: {
    en: 'I resolved nearly all issues reported upstream and implemented nearly all requested features, alongside extensive translation fixes. The application now compares latency and throughput across targets and periods. The additions also cover daily operation: alerts for deviations from usual measurements, traceroute diagnostics, connection-change history and scoped API tokens.',
    de: 'Ich habe nahezu alle im ursprünglichen Projekt gemeldeten Probleme behoben und fast alle dort gewünschten Funktionen umgesetzt. Dazu kommen umfangreiche Korrekturen an den Übersetzungen. Die Anwendung vergleicht Latenz und Datenrate über mehrere Ziele und Zeiträume hinweg. Auch den laufenden Betrieb habe ich erweitert: mit Warnungen bei Abweichungen von üblichen Messwerten, Traceroute-Diagnose, einem Verlauf von Verbindungsänderungen und API-Tokens mit gezielten Berechtigungen.',
  },
  provenance: {
    en: 'This remains a fork of gnmyt/MySpeed. The provider, target, design and operational additions described here are my extensions to that project.',
    de: 'Grundlage bleibt gnmyt/MySpeed. Die hier beschriebenen Erweiterungen bei Anbietern, Testzielen, Oberfläche und Betrieb stammen aus meiner Weiterentwicklung.',
  },
  upstream: 'https://github.com/gnmyt/MySpeed',
  images: [
    {
      image: myspeedStatistics,
      alt: {
        en: 'MySpeed statistics dashboard.',
        de: 'Statistikübersicht in MySpeed.',
      },
      caption: {
        en: 'Redesigned statistics with target filters and comparison periods.',
        de: 'Überarbeitete Statistiken mit Filtern für Testziele und Vergleichszeiträumen.',
      },
    },
    {
      image: myspeedComparison,
      alt: {
        en: 'MySpeed charts and table comparing test targets.',
        de: 'Diagramme und Tabelle zum Vergleich von Testzielen in MySpeed.',
      },
      caption: {
        en: 'Compare latency and throughput across test targets.',
        de: 'Latenz und Datenrate verschiedener Testziele vergleichen.',
      },
    },
  ],
};

export const TUTTO_STORY: ProjectStoryContent = {
  problem: {
    en: 'I wanted to bring the dice-and-card game Tutto to the browser, for game nights on one device and online games with friends.',
    de: 'Ich wollte das Würfel- und Kartenspiel Tutto in den Browser bringen – für Spieleabende an einem Gerät und Online-Partien mit Freunden.',
  },
  contribution: {
    en: 'I built a TypeScript and React application with local play, synchronized online rooms, physical or digital dice, and classic or modernized rules. Players can invite friends through a link or QR code, play against computer opponents, and ask the optional Ask Otto coach for advice.',
    de: 'Ich habe eine Anwendung mit TypeScript und React entwickelt, mit lokalem Spiel, synchronisierten Online-Spielräumen, echten oder digitalen Würfeln und klassischen oder angepassten Regeln. Spieler können Freunde per Link oder QR-Code einladen, gegen Computergegner spielen und die optionale Spielhilfe „Ask Otto“ um Rat fragen.',
  },
  decisions: {
    en: 'Scoring, the Carl, Rita and Otto bots, and the coach share game rules and turn-value calculations. The coach evaluates dice choices and explains a suggested move without playing it for you. Socket.IO synchronizes rooms, while SQLite stores statistics. Online play is designed for trusted friends, with game state largely maintained on player devices.',
    de: 'Punkteberechnung, die Computergegner Carl, Rita und Otto sowie die Spielhilfe greifen auf dieselben Regeln und Zugbewertungen zurück. Die Spielhilfe bewertet mögliche Würfelauswahlen und erklärt einen Vorschlag, ohne den Zug auszuführen. Socket.IO hält die Spielräume synchron, SQLite speichert Statistiken. Das Online-Spiel ist für Partien unter Freunden ausgelegt; der Spielzustand wird überwiegend auf den Geräten der Spieler verwaltet.',
  },
  outcome: {
    en: 'Friends can play together locally or online, resume after a connection interruption, and choose how much guidance they want. The strategy suggestions come from calculations of possible dice outcomes, without an LLM service.',
    de: 'Freunde können vor Ort oder online miteinander spielen, nach einer Verbindungsunterbrechung wieder einsteigen und selbst entscheiden, wie viel Unterstützung sie möchten. Die Spieltipps beruhen auf der Berechnung möglicher Würfelergebnisse und kommen ohne LLM-Dienst aus.',
  },
  diagram: {
    title: { en: 'How a turn works', de: 'So läuft ein Zug ab' },
    steps: [
      { en: 'Draw a card', de: 'Karte ziehen' },
      { en: 'Roll', de: 'Würfeln' },
      { en: 'Choose scoring dice', de: 'Wertende Würfel auswählen' },
      {
        en: 'Bank or continue, depending on the card and rules',
        de: 'Punkte sichern oder weiterspielen, je nach Karte und Regeln',
      },
    ],
  },
};

export const WEBSITE_STORY: ProjectStoryContent = {
  problem: {
    en: 'I wanted a personal site that shows both my software work and the infrastructure behind it, in English and German, running on my own hardware.',
    de: 'Ich wollte eine persönliche Website, die meine Softwareprojekte und die Infrastruktur dahinter zeigt – auf Deutsch und Englisch, betrieben auf meiner eigenen Hardware.',
  },
  contribution: {
    en: 'I built this site with Astro and TypeScript, with reusable components, localized content, light and dark themes, and an interactive terminal. The build produces a separate static tree for each language, including project pages and downloadable CVs.',
    de: 'Ich habe diese Website mit Astro und TypeScript entwickelt, mit wiederverwendbaren Komponenten, zweisprachigen Inhalten, hellem und dunklem Farbschema und einem interaktiven Terminal. Der Build erzeugt für jede Sprache eigene statische Dateien, einschließlich Projektseiten und herunterladbarer Lebensläufe.',
  },
  decisions: {
    en: 'Both languages use the same URLs. nginx selects the static tree from an explicit language cookie or the browser’s Accept-Language preference. Fonts and assets are served locally, and viewing the pages needs no database. Tests cover content contracts, components and language selection.',
    de: 'Beide Sprachen verwenden dieselben URLs. nginx wählt die statischen Dateien anhand der gespeicherten Sprachwahl oder der Spracheinstellung des Browsers aus. Schriften und andere Dateien werden lokal ausgeliefert; zum Anzeigen der Seiten wird keine Datenbank benötigt. Tests prüfen Inhaltsstrukturen, Komponenten und Sprachauswahl.',
  },
  outcome: {
    en: 'GitHub Actions builds a Docker image for the homelab. Cloudflare Tunnel connects visitors to the nginx container, which serves the static pages. The site documents the same setup that delivers it.',
    de: 'GitHub Actions baut ein Docker-Image für das Homelab. Cloudflare Tunnel verbindet Besucher mit dem nginx-Container, der die statischen Seiten ausliefert. Die Website beschreibt damit auch die Infrastruktur, auf der sie selbst läuft.',
  },
  diagram: {
    title: { en: 'Build and delivery', de: 'Build und Auslieferung' },
    steps: [
      {
        en: 'Astro builds English and German pages',
        de: 'Astro baut deutsche und englische Seiten',
      },
      {
        en: 'GitHub Actions packages the Docker image',
        de: 'GitHub Actions erstellt das Docker-Image',
      },
      {
        en: 'Cloudflare Tunnel connects to the homelab',
        de: 'Cloudflare Tunnel verbindet zum Homelab',
      },
      {
        en: 'nginx selects the language and serves static files',
        de: 'nginx wählt die Sprache und liefert statische Dateien aus',
      },
    ],
  },
};

export const CARINI_STORY: ProjectStoryContent = {
  problem: {
    en: 'Our team diploma project at Carini focused on making quality-management documents and process information easier for employees to find and use.',
    de: 'Unsere gemeinsame Diplomarbeit bei Carini sollte Dokumente und Prozessinformationen aus dem Qualitätsmanagement für Mitarbeiter leichter auffindbar und nutzbar machen.',
  },
  contribution: {
    en: 'I carried out most of the technical work: technical design, implementation, and nearly all technical sections of the thesis. The diploma project was a team effort, with my contribution concentrated on the technical solution.',
    de: 'Ich habe den Großteil der technischen Arbeit übernommen: den technischen Entwurf, die Umsetzung und nahezu alle technischen Kapitel der Diplomarbeit. Die Diplomarbeit war eine Teamleistung; mein Schwerpunkt lag auf der technischen Lösung.',
  },
  decisions: {
    en: 'We organized the documents and process information in a SharePoint intranet, with a structure intended to help employees find the material relevant to their work. I documented the technical design and implementation as part of the thesis.',
    de: 'Wir haben die Dokumente und Prozessinformationen in einem SharePoint-Intranet neu organisiert. Die Struktur sollte Mitarbeitern helfen, die für ihre Arbeit relevanten Unterlagen zu finden. Den technischen Entwurf und die Umsetzung habe ich in der Diplomarbeit dokumentiert.',
  },
  outcome: {
    en: 'The team delivered a SharePoint-based quality-management intranet and the accompanying diploma thesis. The project ran from August 2014 to February 2015; my separate internship at Carini ran from July to September 2014.',
    de: 'Das Team erarbeitete ein SharePoint-Intranet für das Qualitätsmanagement und die zugehörige Diplomarbeit. Das Projekt lief von August 2014 bis Februar 2015; mein separates Praktikum bei Carini dauerte von Juli bis September 2014.',
  },
};
