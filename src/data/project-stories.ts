import spotifyGenres from '../assets/projects/spotify-genres.png';
import spotifyCompare from '../assets/projects/spotify-compare.png';
import myspeedStatistics from '../assets/projects/myspeed-statistics.png';
import myspeedComparison from '../assets/projects/myspeed-target-comparison.png';
import bachelorMonteCarlo from '../assets/projects/bachelor-monte-carlo.png';
import cariniProcessMap from '../assets/projects/carini-process-map.png';
import type { ProjectStoryContent } from '../lib/projects';

export const SPOTIFY_STORY: ProjectStoryContent = {
  problem: {
    en: 'I wanted several people to keep their Spotify listening history on one self-hosted instance, with useful statistics and a way to recover plays missed while offline or during interruptions.',
    de: 'Ich wollte, dass mehrere Nutzer ihren Spotify-Hörverlauf auf einer selbst gehosteten Instanz erfassen können – mit aussagekräftigen Statistiken und einer Möglichkeit, verpasste Wiedergaben beim Offline-Hören oder während Ausfällen nachzutragen.',
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
    de: 'Entstanden ist eine selbst gehostete Anwendung für mehrere Nutzer mit Genre-Auswertungen, Jahresrückblicken und Vergleichen. Mit gültigem Spotify-API-Zugang können verpasste Wiedergaben nachgetragen werden, solange Spotify sie noch im jüngsten Hörverlauf bereitstellt. Der Hörverlauf lässt sich nach längeren Ausfällen also nicht beliebig weit zurück wiederherstellen. Last.fm liefert die Zusatzinformationen; fehlende Wiedergaben kommen über Spotify.',
  },
  provenance: {
    en: 'The project began as a fork of TzurSoffer/SpotifyStatsTracker. I subsequently rewrote the application code, database layer and interface.',
    de: 'Das Projekt begann als Fork von TzurSoffer/SpotifyStatsTracker. Anwendungscode, Datenbankzugriff und Oberfläche habe ich anschließend neu entwickelt.',
  },
  upstream: 'https://github.com/TzurSoffer/SpotifyStatsTracker',
  additionalSections: [
    {
      id: 'upstream-import',
      title: {
        en: 'Improving imports upstream',
        de: 'Importe im Upstream-Projekt verbessern',
      },
      text: {
        en: 'With help from an AI coding agent, I contributed an import improvement to TzurSoffer’s original SpotifyStatsTracker project. The importer could fetch missing track metadata in parallel. When the maintainer questioned a sorting change, I removed it. It saved one file read, while network requests were the main bottleneck. The upstream project credited my contribution in release 1.6.11.',
        de: 'Mit Unterstützung eines KI-Coding-Agents trug ich eine Verbesserung für den Import in TzurSoffers ursprünglichem SpotifyStatsTracker bei. Fehlende Titel-Metadaten konnten parallel abgerufen werden. Als der Maintainer eine Änderung an der Sortierung hinterfragte, nahm ich sie zurück. Sie sparte einen Dateizugriff, während die Netzwerkanfragen den Import hauptsächlich verlangsamten. Das Upstream-Projekt erwähnte meinen Beitrag in Version 1.6.11.',
      },
      links: [
        {
          href: 'https://github.com/TzurSoffer/SpotifyStatsTracker/releases/tag/1.6.11',
          label: { en: 'Release 1.6.11', de: 'Version 1.6.11' },
        },
        {
          href: 'https://github.com/TzurSoffer/SpotifyStatsTracker/pull/3#discussion_r3562326826',
          label: { en: 'Review reply', de: 'Antwort im Review' },
        },
      ],
    },
  ],
  images: [
    {
      image: spotifyGenres,
      alt: {
        en: 'SpotifyTracker genre distribution and listening trends.',
        de: 'Genre-Verteilung und Hörverlauf in SpotifyTracker.',
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
    de: 'Ich habe nahezu alle im ursprünglichen Projekt gemeldeten Probleme behoben und fast alle dort gewünschten Funktionen umgesetzt. Dazu kommen umfangreiche Korrekturen an den Übersetzungen. Die Anwendung vergleicht Latenz und Datenrate über mehrere Ziele und Zeiträume hinweg. Für den laufenden Betrieb gibt es weitere Funktionen: Warnungen bei Abweichungen von üblichen Messwerten, Traceroute-Diagnose, einen Verlauf von Verbindungsänderungen und API-Tokens mit gezielten Berechtigungen.',
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
  additionalSections: [
    {
      id: 'kniffel-test-cases',
      title: {
        en: 'Ask Otto’s two Kniffel test cases',
        de: 'Zwei Kniffel-Testfälle für Ask Otto',
      },
      text: {
        en: 'In the Classic coach test, dice 1–5 are already kept, the final die has just landed on 6, the prior turn score is zero and drawing another card is disabled. Otto recommends banking 2,000 points. It shows no bust percentage because there is no next roll. A separate probability test with 1–5 kept and the final die still to be rolled gives a 1-in-6 chance of completing Kniffel in both Classic and Modernized rules.',
        de: 'Im Test der Spielhilfe mit klassischen Regeln sind die Würfel 1–5 bereits behalten. Der letzte Würfel zeigt gerade eine 6, der bisherige Zugpunktestand ist null und eine weitere Karte kann nicht gezogen werden. Otto empfiehlt, 2’000 Punkte zu sichern. Da kein weiterer Wurf möglich ist, zeigt die Spielhilfe keine Wahrscheinlichkeit für einen Fehlwurf an. In einem separaten Wahrscheinlichkeitstest mit 1–5 als behaltenen Würfeln und einem noch ausstehenden letzten Wurf beträgt die Chance, Kniffel abzuschliessen, in beiden Regelvarianten 1 zu 6.',
      },
      links: [
        {
          href: 'https://github.com/i7Gamer/Tutto/blob/ce1f98e4d619c1cf1ddd284e10ce68665aa20437/src/utils/coachHint.test.ts#L192-L218',
          label: { en: 'Coach test', de: 'Test der Spielhilfe' },
        },
        {
          href: 'https://github.com/i7Gamer/Tutto/blob/ce1f98e4d619c1cf1ddd284e10ce68665aa20437/src/utils/turnValue.test.ts#L274-L278',
          label: { en: 'Probability test', de: 'Wahrscheinlichkeitstest' },
        },
      ],
    },
  ],
  diagram: {
    title: { en: 'How a turn works', de: 'So läuft ein Zug ab' },
    steps: [
      { en: 'Draw a card', de: 'Karte ziehen' },
      { en: 'Roll', de: 'Würfeln' },
      { en: 'Choose scoring dice', de: 'Würfel auswählen, die Punkte bringen' },
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
        de: 'Cloudflare Tunnel stellt die Verbindung zum Homelab her',
      },
      {
        en: 'nginx selects the language and serves static files',
        de: 'nginx wählt die Sprache und liefert statische Dateien aus',
      },
    ],
  },
};

export const BACHELOR_STORY: ProjectStoryContent = {
  problem: {
    en: 'Project schedules become difficult to reason about when activities depend on one another and their durations are uncertain. Existing tools I reviewed did not combine graphical PDM networks with CPM, PERT and Monte Carlo analysis in one free application.',
    de: 'Projekttermine werden schwer planbar, wenn Aktivitäten voneinander abhängen und ihre Dauer unsicher ist. Die untersuchten Werkzeuge kombinierten grafische PDM-Netzpläne, CPM, PERT und Monte-Carlo-Simulation nicht in einer frei nutzbaren Anwendung.',
  },
  contribution: {
    en: 'I built the browser-based diagram editor and the Java REST service. Users can create and connect activities, enter minimum, expected and maximum durations, and request the different analyses directly from the diagram.',
    de: 'Ich entwickelte den browserbasierten Diagrammeditor und den Java-REST-Service. Nutzer können Aktivitäten anlegen und verbinden, minimale, erwartete und maximale Dauern erfassen und die verschiedenen Analysen direkt aus dem Diagramm starten.',
  },
  decisions: {
    en: 'JointJS provides editable custom diagram elements and serializes the network as JSON. A Spring Boot service exposes separate endpoints for the critical path, PERT and Monte Carlo simulation. The critical-path calculation traverses every path with depth-first search; the simulation repeatedly samples beta-distributed durations and reuses that calculation.',
    de: 'JointJS ermöglicht eigene, bearbeitbare Diagrammelemente und serialisiert den Netzplan als JSON. Ein Spring-Boot-Service bietet separate Endpunkte für die Berechnung des kritischen Pfads, PERT und die Monte-Carlo-Simulation. Die Berechnung des kritischen Pfads durchläuft alle Pfade per Tiefensuche; die Simulation erzeugt wiederholt zufällige Dauern aus einer Betaverteilung und berechnet damit jeweils den kritischen Pfad.',
  },
  outcome: {
    en: 'The finished application models PDM networks, validates invalid graphs such as cycles, highlights critical activities, and displays early and late start and finish times. It also calculates PERT durations and, through Monte Carlo simulation, duration variance and each activity’s probability of lying on the critical path.',
    de: 'Die fertige Anwendung modelliert PDM-Netzpläne, erkennt ungültige Graphen, etwa solche mit Zyklen, hebt kritische Aktivitäten hervor und zeigt früheste sowie späteste Start- und Endzeitpunkte. Zusätzlich berechnet sie PERT-Dauern und über die Monte-Carlo-Simulation die Varianz der Projektdauer sowie die Wahrscheinlichkeit, dass eine Aktivität auf dem kritischen Pfad liegt.',
  },
  images: [
    {
      image: bachelorMonteCarlo,
      alt: {
        en: 'Flowchart of the Monte Carlo simulation from the bachelor thesis.',
        de: 'Flussdiagramm der Monte-Carlo-Simulation aus der Bachelorarbeit.',
      },
      caption: {
        en: 'The original thesis flowchart: sample durations, calculate the critical path, then aggregate variance and probabilities.',
        de: 'Das Flussdiagramm aus der Bachelorarbeit: Dauern simulieren, den kritischen Pfad berechnen und anschließend Varianz und Wahrscheinlichkeiten zusammenfassen.',
      },
    },
  ],
};

export const CARINI_STORY: ProjectStoryContent = {
  problem: {
    en: 'Carini’s quality-management documents were distributed across many SharePoint libraries, some containing thousands of files. Employees often had to know the library structure or rely on full-text search to find material for a particular business process.',
    de: 'Carinis Qualitätsmanagement-Dokumente waren auf viele SharePoint-Bibliotheken verteilt, von denen einige tausende Dateien enthielten. Mitarbeiter mussten die Bibliotheksstruktur kennen oder sich auf die Volltextsuche verlassen, um Unterlagen für einen bestimmten Geschäftsprozess zu finden.',
  },
  contribution: {
    en: 'The diploma project was a team effort. My work concentrated on the technical solution: navigation and document views, implementation, technical design, documentation, and nearly all technical sections of the thesis.',
    de: 'Die Diplomarbeit war eine Teamleistung. Mein Schwerpunkt lag auf dem technischen Entwurf und der Umsetzung, insbesondere auf Navigation und Dokumentenansichten. Außerdem übernahm ich die technische Dokumentation und verfasste nahezu alle technischen Kapitel der Diplomarbeit.',
  },
  decisions: {
    en: 'A three-level interface leads from a process map through sub-processes to a cross-library document view. Custom SharePoint Display Templates reproduce the familiar library view while filtering by process metadata and document type. JavaScript and jQuery add navigation, sorting, date-range search, contextual search help and document callouts.',
    de: 'Eine dreistufige Oberfläche führt von der Prozesslandkarte über Unterprozesse zu einer bibliotheksübergreifenden Dokumentenansicht. Angepasste SharePoint-Anzeigevorlagen (Display Templates) bilden die vertraute Bibliotheksansicht nach und filtern nach Prozess-Metadaten und Dokumenttyp. JavaScript und jQuery ergänzen Navigation, Sortierung, die Suche nach Datumsbereichen, kontextbezogene Suchhilfe und Informationsfenster zu Dokumenten.',
  },
  outcome: {
    en: 'Carini put the system into production. The thesis records that every project goal was met, additional search-help and date features were delivered, and the project finished about six weeks early using 75% of the planned budget. Internship: July–September 2014. Diploma project: 2014/15 school year.',
    de: 'Carini nahm das System produktiv in Betrieb. Laut Diplomarbeit wurden alle Projektziele erreicht, zusätzliche Suchhilfe- und Datumsfunktionen umgesetzt und das Projekt rund sechs Wochen vor dem geplanten Termin mit 75 Prozent des vorgesehenen Budgets abgeschlossen. Praktikum: Juli–September 2014. Diplomarbeit: Schuljahr 2014/15.',
  },
  images: [
    {
      image: cariniProcessMap,
      alt: {
        en: 'SharePoint page showing a Carini business-process map.',
        de: 'SharePoint-Seite mit der Geschäftsprozesslandkarte von Carini.',
      },
      caption: {
        en: 'The process map formed the first two navigation levels; selecting a sub-process opened its filtered document view.',
        de: 'Die Prozesslandkarte bildete die ersten beiden Navigationsebenen; die Auswahl eines Unterprozesses öffnete die gefilterte Dokumentenansicht.',
      },
    },
  ],
};

export const HEARTHCOIL_STORY: ProjectStoryContent = {
  problem: {
    en: 'I am building Hearthcoil, a one-to-four-player couch co-op action game in Unity inspired by Gauntlet: Slayer Edition. Combat and enemy encounters need to work as part of a clear level progression.',
    de: 'Ich entwickle Hearthcoil, ein Couch-Koop-Actionspiel für ein bis vier Spieler in Unity, inspiriert von Gauntlet: Slayer Edition. Kämpfe und Gegnerbegegnungen sollen sich in einen klaren Levelverlauf einfügen.',
  },
  contribution: {
    en: 'I have worked on combat, enemy encounters and level progression. I performed attack movements myself and filmed them from two angles as animation reference. I also built and iterated on a supervisor, its shared database and a dashboard for coordinating coding-agent work across several machines.',
    de: 'Ich habe an Kämpfen, Gegnerbegegnungen und dem Levelverlauf gearbeitet. Ich habe Angriffsbewegungen selbst vorgemacht und aus zwei Blickwinkeln gefilmt, um sie als Animationsreferenz für Hearthcoil zu nutzen. Außerdem entwickelte und verbesserte ich einen Supervisor mit gemeinsamer Datenbank und Dashboard, um die Arbeit von Coding-Agents auf mehreren Rechnern zu koordinieren.',
  },
  decisions: {
    en: 'I separated gameplay rules from the Unity code that displays them so I can test combat behaviour without loading a complete level. The supervisor database records assignments, blockers, reviews and test evidence. The dashboard and companion app show what is running, waiting on Unity or needs my attention.',
    de: 'Ich trennte die Spielregeln vom Unity-Code für ihre Darstellung. Dadurch kann ich das Kampfverhalten testen, ohne ein ganzes Level zu laden. Die Supervisor-Datenbank hält Aufgaben, Blockaden sowie Review- und Testnachweise fest. Dashboard und Begleit-App zeigen, was läuft, auf Unity wartet oder meine Aufmerksamkeit braucht.',
  },
  outcome: {
    en: 'I playtest Hearthcoil weekly and use those sessions to spot gameplay issues. One early takeaway was that some encounters felt too easy, so I tried increasing enemy pressure and adding enemies during boss fights. Keeping implementation, review and test execution distinct also makes it easier to see what has actually been verified and what still needs a decision.',
    de: 'Ich teste Hearthcoil wöchentlich im Spiel und nutze diese Runden, um Probleme im Gameplay zu erkennen. Ein früher Eindruck war, dass manche Kämpfe zu leicht waren; beim Prototyping erhöhte ich daher den Gegnerdruck und ergänzte während Bosskämpfen weitere Gegner. Die Trennung von Umsetzung, Review und Testausführung macht außerdem sichtbar, was tatsächlich geprüft wurde und wo noch eine Entscheidung nötig ist.',
  },
  additionalSections: [
    {
      id: 'playtest-feedback',
      title: { en: 'Playtest feedback', de: 'Feedback aus einem Spieltest' },
      text: {
        en: 'During a playtest, I noticed that a character’s free hand didn’t look like it was supporting the launcher while firing. I asked for the pose to be corrected. The team adjusted the animation and added a Unity test that checks the hand position during playback.',
        de: 'Bei einem Spieltest fiel mir auf, dass die freie Hand einer Figur den Werfer beim Abfeuern scheinbar nicht stützte. Ich bat darum, die Haltung zu korrigieren. Das Team passte die Animation an und ergänzte einen Unity-Test, der die Handposition beim Abspielen prüft.',
      },
    },
    {
      id: 'coilwatch',
      title: { en: 'Coilwatch', de: 'Coilwatch' },
      text: {
        en: 'I started Coilwatch as a mobile companion to my development dashboard. The app shows what Hearthcoil’s AI assistants are working on and notifies me when something needs my decision. I chose a compact list over large cards so I could see more at a glance on my phone.',
        de: 'Ich habe Coilwatch als mobile Ergänzung zu meinem Entwicklungsdashboard begonnen. Die App zeigt, woran die KI-Assistenten für Hearthcoil arbeiten, und benachrichtigt mich, wenn ich etwas entscheiden muss. Mit einer kompakten Liste statt grosser Karten sehe ich auf dem Handy mehr auf einen Blick.',
      },
    },
    {
      id: 'coilwatch-notifications',
      title: {
        en: 'Coilwatch push notifications',
        de: 'Push-Nachrichten in Coilwatch',
      },
      text: {
        en: 'The tool I used to build Coilwatch initially refused to enable push notifications. I checked with support and found that the builder was blocking push for this export. I brought that answer back and got push enabled in the next app export. Coilwatch could then notify me when Hearthcoil needed a decision, so I didn’t have to keep checking the dashboard.',
        de: 'Das Werkzeug, mit dem ich Coilwatch gebaut habe, liess Push-Nachrichten zunächst nicht zu. Der Support bestätigte, dass der App-Baukasten Push in diesem Fall blockierte. Mit dieser Auskunft konnte ich Push-Nachrichten im nächsten App-Export aktivieren. Danach konnte mich Coilwatch benachrichtigen, wenn für Hearthcoil eine Entscheidung anstand, ohne dass ich ständig das Dashboard prüfen musste.',
      },
    },
  ],
};
