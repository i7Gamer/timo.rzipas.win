import type { Locale } from '../i18n';

type LocalizedNote = Record<Locale, string>;

interface ProjectAINote {
  development: LocalizedNote;
  developmentUndocumented?: true;
  product: LocalizedNote;
  commits?: Array<{ href: string; label: LocalizedNote }>;
}

const tuttoCommits = [
  {
    href: 'https://github.com/i7Gamer/Tutto/commit/b18cb41a1a78403397d6f0f2e60535d35f9eda41',
    label: {
      en: 'Scoring advice fix',
      de: 'Korrektur der Punkteempfehlung',
    },
  },
  {
    href: 'https://github.com/i7Gamer/Tutto/commit/e1fb80766dbf196ddc90b5b58eb0f1fc90f779d5',
    label: {
      en: 'Restrict advice to legal buttons',
      de: 'Empfehlung auf erlaubte Aktionen begrenzen',
    },
  },
];

export const PROJECT_AI_NOTES: Readonly<
  Partial<Record<string, ProjectAINote>>
> = {
  hearthcoil: {
    development: {
      en: 'Timo uses Claude Code and Codex to implement changes and obtain independent reviews. He reviews diffs, checks test results and playtests weekly. A supervisor, dashboard and companion app coordinate development, reviews and Unity runs.',
      de: 'Timo nutzt Claude Code und Codex für Änderungen und unabhängige Reviews. Er prüft Diffs und Testergebnisse und spielt wöchentlich. Supervisor, Dashboard und Companion-App koordinieren Entwicklung, Reviews und Unity-Läufe.',
    },
    product: {
      en: 'These are development tools. Use of an LLM for enemies or gameplay has not been verified.',
      de: 'Das sind Entwicklungswerkzeuge. Ein LLM-Einsatz bei Gegnern oder im Spielablauf ist nicht verifiziert.',
    },
  },
  tutto: {
    development: {
      en: 'Claude co-authored a verified scoring fix. Advice for a completed Kniffel showed 0 points at stake instead of the game’s 2,000. The advice was aligned with shared scoring and tested, then restricted to legal buttons.',
      de: 'Claude wirkte nachweislich an einer Punktekorrektur mit. Bei einem fertigen Kniffel zeigte die Hilfe 0 statt der im Spiel geltenden 2.000 Punkte. Die Empfehlung wurde an die gemeinsame Punkteberechnung angepasst und getestet, danach auf erlaubte Aktionen begrenzt.',
    },
    product: {
      en: 'Ask Otto evaluates dice outcomes using rules and probabilities without an LLM. It recommends a move but leaves it to the player.',
      de: 'Ask Otto bewertet Würfelergebnisse anhand von Regeln und Wahrscheinlichkeiten, ohne ein LLM zu verwenden. Es empfiehlt einen Zug, überlässt ihn aber der spielenden Person.',
    },
    commits: tuttoCommits,
  },
  'spotify-stats-tracker': {
    development: {
      en: 'Claude co-authored a change restricting downloaded image formats. This maintenance commit does not establish what share, if any, of the original rewrite used AI.',
      de: 'Claude wirkte an einer Änderung mit, die erlaubte Bildformate für Downloads einschränkt. Dieser Wartungs-Commit belegt nicht, ob und in welchem Umfang die ursprüngliche Neuentwicklung KI nutzte.',
    },
    product: {
      en: 'The app reconciles listening history with the Spotify API and adds Last.fm metadata. No AI product feature is documented here.',
      de: 'Die App gleicht den Hörverlauf mit der Spotify-API ab und ergänzt Last.fm-Metadaten. Eine KI-Funktion ist hier nicht dokumentiert.',
    },
    commits: [
      {
        href: 'https://github.com/i7Gamer/SpotifyTracker/commit/0b72feda1046f42494d666d3f5f905d78cd94f72',
        label: {
          en: 'Image format restriction',
          de: 'Einschränkung der Bildformate',
        },
      },
    ],
  },
  myspeed: {
    development: {
      en: 'Claude co-authored changes to streaming exports and lazy dependency loading in Timo’s fork to reduce memory use during exports and startup. This attribution applies to the fork and does not imply AI authorship of upstream MySpeed.',
      de: 'Claude wirkte an Änderungen für Streaming-Exporte und verzögertes Laden von Abhängigkeiten in Timos Fork mit, die den Speicherbedarf bei Exporten und beim Start senken. Diese Zuordnung gilt für den Fork und nicht für das ursprüngliche MySpeed.',
    },
    product: {
      en: 'MySpeed measures network performance using tools including iperf3. The fork documents no AI product feature.',
      de: 'MySpeed misst die Netzwerkleistung unter anderem mit iperf3. Für den Fork ist keine KI-Funktion dokumentiert.',
    },
    commits: [
      {
        href: 'https://github.com/i7Gamer/MySpeed/commit/3b07bfc89451dfd8f08c82eca56de3108881d0d3',
        label: {
          en: 'Streaming exports and lazy dependencies',
          de: 'Streaming-Export und verzögerte Abhängigkeiten',
        },
      },
    ],
  },
  'this-website': {
    development: {
      en: 'Claude co-authored the homepage and contact panel. The commit documents that contribution.',
      de: 'Claude wirkte an der Startseite und dem Kontaktbereich mit. Der Commit dokumentiert diesen Beitrag.',
    },
    product: {
      en: 'The AI assistant is a local prototype. A local model selects facts, answers cite public sources and it can abstain.',
      de: 'Der KI-Assistent ist ein lokaler Prototyp. Ein lokales Modell wählt Fakten aus, Antworten nennen öffentliche Quellen und das Modell kann sich enthalten.',
    },
    commits: [
      {
        href: 'https://github.com/i7Gamer/timo.rzipas.win/commit/30d791eddaa0a9e5bda322853510b7e16bb4a1a2',
        label: {
          en: 'Homepage and contact panel',
          de: 'Startseite und Kontaktbereich',
        },
      },
    ],
  },
  'bachelor-thesis': {
    developmentUndocumented: true,
    development: {
      en: 'No AI use during the original development has been verified.',
      de: 'Ein KI-Einsatz bei der ursprünglichen Entwicklung ist nicht belegt.',
    },
    product: {
      en: 'Monte Carlo is a statistical simulation method in the schedule analysis, not an AI feature.',
      de: 'Monte Carlo ist eine statistische Simulationsmethode der Terminplanung, keine KI-Funktion.',
    },
  },
  'carini-management-system': {
    developmentUndocumented: true,
    development: {
      en: 'No AI use during the original development has been verified.',
      de: 'Ein KI-Einsatz bei der ursprünglichen Entwicklung ist nicht belegt.',
    },
    product: {
      en: 'CARINI is a SharePoint document-management system. No AI feature is documented.',
      de: 'CARINI ist ein SharePoint-Dokumentenmanagementsystem. Eine KI-Funktion ist nicht dokumentiert.',
    },
  },
};
