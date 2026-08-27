import { STORAGE_TOTAL } from '../data/hardware';

const en = {
  'site.name': 'Timo Rzipa',
  'site.description':
    'Timo Rzipa — software engineer and self-hosting enthusiast. Projects, homelab, and the infrastructure that serves this very site.',

  'skip.content': 'Skip to content',

  'og.imageAlt': 'Timo Rzipa — software engineer and self-hoster',

  'nav.home': 'Home',
  'nav.projects': 'Projects',
  'nav.homelab': 'Homelab',
  'nav.about': 'About',

  'hero.greeting': "Hi, I'm Timo.",
  'hero.tagline': 'Software engineer by day, self-hoster after hours.',
  'hero.intro':
    'I build business software in Java at Abacus Research — and run a small data center in my living room. This site is served straight from it.',
  'hero.role': 'Software Engineer',
  'hero.location': 'Lake Constance region (AT/CH)',
  'hero.cta.projects': 'View projects',
  'hero.cta.homelab': 'Tour the homelab',

  'terminal.title': 'timo@homelab:~',
  'terminal.whoami.cmd': 'whoami',
  'terminal.whoami.out': 'Timo Rzipa · Software Engineer @ Abacus Research AG',
  'terminal.skills.cmd': 'cat skills.txt',
  'terminal.skills.out':
    'Java · C# · TypeScript · Angular · Vue · SQL · Docker · Networking',
  'terminal.health.cmd': 'curl -s https://timo.rzipas.win/healthz',
  'terminal.health.out': 'ok — served from the living room',
  'terminal.help.out':
    'commands: help · ls · cd <page> · cat skills.txt · whoami · sudo · curl healthz · clear',
  'terminal.sudo.out': 'Nice try — this homelab already has an owner.',
  'terminal.input.label': 'Terminal input',

  'section.featured.title': 'Featured projects',
  'section.featured.all': 'All projects',
  'section.homelabTeaser.title': 'The homelab',
  'section.homelabTeaser.text': `A self-built server with ${STORAGE_TOTAL} of storage, running the services I use every day — including this website.`,
  'section.homelabTeaser.cta': 'Take the tour',

  'projects.title': 'Projects',
  'projects.intro':
    'I like turning my own data into something I can actually look at: collect it myself, host it myself, then chart it until it answers the question I started with.',
  'project.source': 'Source',
  'project.visit': 'Visit',
  'project.status.active': 'active',
  'project.status.archived': 'archived',
  'project.status.fork': 'fork',

  'homelab.title': 'Homelab',
  'homelab.intro':
    "Programming is half the story. The other half is the infrastructure it runs on: a self-built server in the living room instead of somebody else's cloud.",
  'homelab.hardware.title': 'Hardware',
  'homelab.machine.server': 'Server',
  'homelab.machine.workstation': 'Workstation',
  'homelab.hw.cpu': 'CPU',
  'homelab.hw.ram': 'Memory',
  'homelab.hw.board': 'Mainboard',
  'homelab.hw.gpu': 'Graphics',
  'homelab.hw.network': 'Network',
  'homelab.hw.storage': 'Storage',
  'homelab.hw.storage.value': `${STORAGE_TOTAL} across 10 drives`,
  'homelab.hw.storage.workstation': '3.2 TB SSD',
  'homelab.hw.os': 'Operating system',
  'homelab.hw.os.workstation': 'Windows 11 Pro + CachyOS',
  'homelab.services.title': 'Running services',
  'homelab.services.note':
    'Status dots are live — checked from inside the homelab every few minutes.',
  'homelab.why.title': 'Why self-host?',
  'homelab.why.text':
    'Running services myself means understanding the whole stack — DNS, TLS, reverse proxies, backups, monitoring — and it turns abstract cloud concepts into hardware I can actually touch. It also keeps my data on my own disks — where it is mine to measure, query and turn into a chart whenever something makes me curious.',
  'homelab.diagram.title': 'How a request reaches this page',
  'diagram.visitor': 'Visitor',
  'diagram.cloudflare': 'Cloudflare · DNS + TLS',
  'diagram.tunnel': 'cloudflared tunnel · no open ports',
  'diagram.nginx': 'nginx · picks EN/DE',
  'diagram.site': 'Astro static files',
  'stats.storage': 'storage',
  'stats.ram': 'memory',
  'stats.uptime': 'self-hosted',
  'stats.services': 'services',
  'status.online': 'online',
  'status.planned': 'planned',
  'status.offline': 'offline',
  'status.asOf': '(as of {time})',

  'about.title': 'About',
  'about.intro':
    "I'm a software engineer from Austria's Lake Constance region. Since 2019 I've been building business software in Java at Abacus Research in Switzerland; before that I worked on rail data services at Stadler. Away from the keyboard — who am I kidding, still at the keyboard — I run a homelab and turn \"I could self-host that\" into weekend projects.",
  'about.experience.title': 'Experience',
  'about.education.title': 'Education',
  'about.skills.title': 'Skills',
  'about.languages.title': 'Languages',
  'about.present': 'present',

  'lang.switch.label': 'Zu Deutsch wechseln',
  'lang.switch.code': 'DE',
  'a11y.toggleTheme': 'Toggle color theme',
  'a11y.mainNav': 'Main',
  'a11y.email': 'Email',

  'footer.selfHosted': 'Self-hosted on my own hardware',
  'footer.source': 'Source',
  'footer.build': 'build',

  'notFound.title': '404 — command not found',
  'notFound.message': `This page does not exist — not even on ${STORAGE_TOTAL} of storage.`,
  'notFound.home': 'Back home',
} as const;

export type UIKey = keyof typeof en;

const de: Partial<Record<UIKey, string>> = {
  'site.description':
    'Timo Rzipa — Software Engineer und Self-Hosting-Enthusiast. Projekte, Homelab und die Infrastruktur, die genau diese Seite ausliefert.',

  'skip.content': 'Zum Inhalt springen',

  'og.imageAlt': 'Timo Rzipa — Software Engineer und Self-Hoster',

  'nav.home': 'Start',
  'nav.projects': 'Projekte',
  'nav.homelab': 'Homelab',
  'nav.about': 'Über mich',

  'hero.greeting': 'Hi, ich bin Timo.',
  'hero.tagline': 'Software Engineer im Beruf, Self-Hoster nach Feierabend.',
  'hero.intro':
    'Beruflich entwickle ich Business-Software in Java bei Abacus Research — privat betreibe ich ein kleines Rechenzentrum im Wohnzimmer. Diese Seite wird direkt daraus ausgeliefert.',
  'hero.location': 'Bodenseeregion (AT/CH)',
  'hero.cta.projects': 'Projekte ansehen',
  'hero.cta.homelab': 'Homelab erkunden',

  'terminal.health.out': 'ok — ausgeliefert aus dem Wohnzimmer',
  'terminal.help.out':
    'Befehle: help · ls · cd <seite> · cat skills.txt · whoami · sudo · curl healthz · clear',
  'terminal.sudo.out':
    'Netter Versuch — dieses Homelab hat schon einen Besitzer.',
  'terminal.input.label': 'Terminal-Eingabe',

  'section.featured.title': 'Ausgewählte Projekte',
  'section.featured.all': 'Alle Projekte',
  'section.homelabTeaser.title': 'Das Homelab',
  'section.homelabTeaser.text': `Ein selbst gebauter Server mit ${STORAGE_TOTAL} Speicher, auf dem die Dienste laufen, die ich täglich nutze — inklusive dieser Website.`,
  'section.homelabTeaser.cta': 'Zur Tour',

  'projects.title': 'Projekte',
  'projects.intro':
    'Ich mache aus meinen eigenen Daten gerne etwas, das man sich ansehen kann: selbst erfassen, selbst hosten und so lange visualisieren, bis es die Frage beantwortet, mit der alles anfing.',
  'project.source': 'Quellcode',
  'project.visit': 'Ansehen',
  'project.status.active': 'aktiv',
  'project.status.archived': 'archiviert',
  'project.status.fork': 'Fork',

  'homelab.intro':
    'Programmieren ist die halbe Geschichte. Die andere Hälfte ist die Infrastruktur, auf der alles läuft: ein selbst gebauter Server im Wohnzimmer statt einer fremden Cloud.',
  'homelab.machine.server': 'Server',
  'homelab.machine.workstation': 'Workstation',
  'homelab.hw.ram': 'Arbeitsspeicher',
  'homelab.hw.board': 'Mainboard',
  'homelab.hw.gpu': 'Grafik',
  'homelab.hw.network': 'Netzwerk',
  'homelab.hw.storage': 'Speicher',
  'homelab.hw.storage.value': `${STORAGE_TOTAL} auf 10 Platten`,
  'homelab.hw.storage.workstation': '3,2 TB SSD',
  'homelab.hw.os': 'Betriebssystem',
  'homelab.services.title': 'Laufende Dienste',
  'homelab.services.note':
    'Die Status-Punkte sind live — alle paar Minuten direkt aus dem Homelab geprüft.',
  'homelab.why.title': 'Warum Self-Hosting?',
  'homelab.why.text':
    'Dienste selbst zu betreiben heißt, den ganzen Stack zu verstehen — DNS, TLS, Reverse Proxies, Backups, Monitoring — und aus abstrakten Cloud-Konzepten wird Hardware, die man anfassen kann. Und meine Daten bleiben auf meinen eigenen Platten — dort kann ich sie messen, auswerten und visualisieren, sobald mich etwas neugierig macht.',
  'homelab.diagram.title': 'Wie eine Anfrage diese Seite erreicht',
  'diagram.visitor': 'Besucher',
  'diagram.cloudflare': 'Cloudflare · DNS + TLS',
  'diagram.tunnel': 'cloudflared-Tunnel · keine offenen Ports',
  'diagram.nginx': 'nginx · wählt EN/DE',
  'diagram.site': 'Statische Astro-Dateien',
  'stats.storage': 'Speicher',
  'stats.ram': 'Arbeitsspeicher',
  'stats.uptime': 'selbst gehostet',
  'stats.services': 'Dienste',
  'status.planned': 'geplant',
  'status.offline': 'offline',
  'status.asOf': 'Stand: {time}',

  'about.title': 'Über mich',
  'about.intro':
    'Ich bin Software Engineer aus der Bodenseeregion. Seit 2019 entwickle ich bei Abacus Research in der Schweiz Business-Software in Java; davor habe ich bei Stadler an Rail Data Services gearbeitet. Abseits der Tastatur — machen wir uns nichts vor: immer noch an der Tastatur — betreibe ich ein Homelab und mache aus „das könnte ich selbst hosten“ Wochenendprojekte.',
  'about.experience.title': 'Berufserfahrung',
  'about.education.title': 'Ausbildung',
  'about.languages.title': 'Sprachen',
  'about.present': 'heute',

  'lang.switch.label': 'Switch to English',
  'lang.switch.code': 'EN',
  'a11y.toggleTheme': 'Farbschema wechseln',
  'a11y.mainNav': 'Hauptnavigation',
  'a11y.email': 'E-Mail',

  'footer.selfHosted': 'Self-hosted auf eigener Hardware',
  'footer.source': 'Quellcode',
  'footer.build': 'Build',

  'notFound.title': '404 — command not found',
  'notFound.message': `Diese Seite existiert nicht — nicht einmal auf ${STORAGE_TOTAL} Speicher.`,
  'notFound.home': 'Zur Startseite',
};

/**
 * Keys deliberately identical in every locale, so the German dictionary
 * leaves them out and the English value is used verbatim: proper nouns, the
 * shell commands the fake terminal types, and words German borrows as-is.
 *
 * Everything NOT listed here must be translated — src/i18n/index.test.ts
 * fails otherwise, so a forgotten translation can no longer ship silently
 * as English on the German site.
 */
export const SHARED_KEYS: readonly UIKey[] = [
  // Names and product strings that do not translate.
  'site.name',
  'hero.role',
  'terminal.whoami.out',
  'homelab.hw.os.workstation',
  // The terminal types real shell commands, whatever the page language.
  'terminal.title',
  'terminal.whoami.cmd',
  'terminal.skills.cmd',
  'terminal.skills.out',
  'terminal.health.cmd',
  // Same word in German.
  'homelab.title',
  'homelab.hardware.title',
  'homelab.hw.cpu',
  'status.online',
  'about.skills.title',
];

export const ui: {
  en: Record<UIKey, string>;
  de: Partial<Record<UIKey, string>>;
} = { en, de };
