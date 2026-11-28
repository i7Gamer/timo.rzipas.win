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
  'nav.about': 'About me',
  'nav.menu': 'Menu',

  'hero.greeting': "Hi, I'm Timo.",
  'hero.intro':
    "At Abacus, I'm primarily responsible for the Java/Vaadin ERP workflow for receivables and payables documents after automatic recognition. I'm building Hearthcoil, a local co-op indie game in Unity.",
  'hero.role': 'Software Engineer',
  'hero.location': 'Based in Switzerland',
  'hero.cta.about': 'About me',
  'hero.cta.cv': 'CV (EN)',
  'hero.portraitAlt': 'Portrait of Timo Rzipa',

  'terminal.title': 'timo@homelab:~',
  'terminal.whoami.cmd': 'whoami',
  'terminal.whoami.out':
    'Timo Rzipa · Java · Automated ERP document processing',
  'terminal.skills.cmd': 'cat skills.txt',
  'terminal.skills.out':
    'Java · C# · TypeScript · Angular · Vue · SQL · Docker · Networking',
  'terminal.health.cmd': 'curl -s https://timo.rzipas.win/healthz',
  'terminal.health.out': 'ok — served from the living room',
  'terminal.help.out':
    'commands: help · ls · cd <page> · cat skills.txt · whoami · sudo · curl healthz · clear',
  'terminal.sudo.out': 'Nice try — this homelab already has an owner.',
  'terminal.input.label': 'Terminal input',
  'terminal.clear.out': 'Terminal cleared.',

  'section.featured.title': 'Featured projects',
  'section.featured.all': 'All projects',
  'ask.title': 'Ask about Timo',
  'ask.examples': 'Example questions',
  'ask.start.homelab': 'Tell me about the homelab',
  'ask.start.spotify': 'What is SpotifyTracker?',
  'ask.start.ai': 'How does Timo use AI?',
  'ask.evidence': 'Supporting excerpts',
  'ask.topic': 'Talking about {subject}',
  'ask.label': 'Your question',
  'ask.placeholder': 'Ask about a project, or follow up…',
  'ask.hint':
    'Ask about my projects or experience. Please leave out personal or confidential information.',
  'ask.send': 'Ask',
  'ask.history':
    'Selected earlier questions and replies may be sent to the local gateway for context. Local-only turns stay in this tab.',
  'ask.conversation': 'Conversation with Ask about Timo',
  'ask.newChat': 'New chat',
  'ask.wait': 'Let me look…',
  'ask.offline': 'I had trouble looking that up. Try again in a moment.',
  'ask.partial': 'The sources only support part of an answer.',
  'ask.related': 'Related detail from the site.',
  'ask.seePage':
    'I don’t see that specific detail. Here’s where you can read more.',
  'ask.missingSubject':
    'I don’t have that detail about {subject}. Here’s the source we were looking at.',
  'ask.spec': 'The {spec} listed for {subject} is {value}.',
  'ask.missing': 'Still open in these excerpts: “{detail}”',
  'ask.length': 'Enter a question of 1–500 characters.',
  'ask.limited': 'Too many questions. Try again in a moment.',
  'section.homelabTeaser.title': 'The homelab',
  'section.homelabTeaser.text': `A self-built server with ${STORAGE_TOTAL} of storage, running the services I use every day — including this website.`,
  'section.homelabTeaser.cta': 'Take the tour',

  'projects.title': 'Projects',
  'projects.intro':
    'I build software for things I want to use myself: listening statistics, network monitoring and games with friends. Alongside those projects, you’ll find this website and earlier academic work.',
  'project.source': 'Source',
  'project.details': 'Project details',
  'project.contribution': 'My contribution',
  'project.back': 'All projects',
  'project.story.problem': 'Starting point',
  'project.story.contribution': 'What I built',
  'project.story.decisions': 'Engineering decisions',
  'project.story.outcome': 'The result',
  'project.upstream': 'Original project',
  'project.screenshots': 'A look inside',
  'project.screenshots.open': 'Open full-size image',
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
  'homelab.machine.devserver': 'Dev server',
  'homelab.machine.server.role': 'Always on: hosts this site and every service',
  'homelab.machine.workstation.role': 'Daily driver: coding, gaming, local AI',
  'homelab.machine.devserver.role':
    'Playground: experiments, builds, test setups',
  'homelab.hw.cpu': 'CPU',
  'homelab.hw.ram': 'Memory',
  'homelab.hw.board': 'Mainboard',
  'homelab.hw.gpu': 'GPU',
  'homelab.hw.network': 'Network',
  'homelab.hw.storage': 'Storage',
  'homelab.hw.storage.value': `${STORAGE_TOTAL} across 10 drives`,
  'homelab.hw.storage.workstation': '3 TB SSD',
  'homelab.hw.storage.devserver': '1.25 TB SSD · 6 TB HDD',
  'homelab.hw.os': 'OS',
  'homelab.hw.os.workstation': 'Windows 11 Pro + CachyOS',
  'homelab.services.title': 'Running services',
  'homelab.services.note':
    'Services are checked from inside the homelab every few minutes. Unverified statuses are shown as unknown.',
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
  'status.unknown': 'unknown',
  'status.asOf': '(as of {time})',
  'services.count': '{total} services',
  'services.summaryLive': '{total} services · {online} online · checked {time}',
  'services.groupOnline': '{online}/{total} online',
  'service.badge.own': 'my project',
  'service.badge.contributor': 'contributor',

  'about.title': 'About me',
  'about.intro':
    "I'm a software engineer based in Switzerland, originally from the Lake Constance region. I like software that quietly removes work from people's desks — from automated document processing in a large ERP system to the C# plug-ins I built as an intern. I enjoy the whole path from understanding a messy process to shipping something maintainable, and I keep learning by building: personal projects, open-source contributions like MySpeed, and a homelab that serves this very site.",
  'about.experience.title': 'Experience',
  'about.education.title': 'Education',
  'about.skills.title': 'Skills',
  'about.languages.title': 'Languages',
  'about.present': 'present',
  'about.qualifications.title': 'Certificates & courses',
  'contact.cv.en': 'English CV · PDF',
  'contact.cv.de': 'German CV · PDF',

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
  'nav.menu': 'Menü',

  'hero.greeting': 'Hi, ich bin Timo.',
  'hero.intro':
    'Bei Abacus verantworte ich vor allem den Java/Vaadin-ERP-Workflow, der Debitoren- und Kreditorenbelege nach der automatischen Erkennung verarbeitet. In Unity entwickle ich Hearthcoil, ein Indie-Spiel mit lokalem Koop.',
  'hero.location': 'Wohnhaft in der Schweiz',
  'hero.cta.about': 'Über mich',
  'hero.cta.cv': 'Lebenslauf (DE)',
  'hero.portraitAlt': 'Porträt von Timo Rzipa',

  'terminal.whoami.out':
    'Timo Rzipa · Java · Automatisierte Belegverarbeitung im ERP',
  'terminal.health.out': 'ok — ausgeliefert aus dem Wohnzimmer',
  'terminal.help.out':
    'Befehle: help · ls · cd <seite> · cat skills.txt · whoami · sudo · curl healthz · clear',
  'terminal.sudo.out':
    'Netter Versuch — dieses Homelab hat schon einen Besitzer.',
  'terminal.input.label': 'Terminal-Eingabe',
  'terminal.clear.out': 'Terminal geleert.',

  'section.featured.title': 'Ausgewählte Projekte',
  'ask.title': 'Fragen zu Timo',
  'ask.examples': 'Beispielfragen',
  'ask.start.homelab': 'Erzähl mir vom Homelab',
  'ask.start.spotify': 'Was ist SpotifyTracker?',
  'ask.start.ai': 'Wofür nutzt Timo KI?',
  'ask.evidence': 'Belegstellen',
  'ask.topic': 'Thema: {subject}',
  'ask.label': 'Deine Frage',
  'ask.placeholder': 'Frag nach einem Projekt oder frage nach …',
  'ask.hint':
    'Frag nach meinen Projekten oder meiner Berufserfahrung. Bitte gib keine persönlichen oder vertraulichen Informationen ein.',
  'ask.send': 'Fragen',
  'ask.history':
    'Ausgewählte frühere Fragen und Antworten können zur Einordnung an das lokale Gateway gesendet werden. Rein lokale Nachrichten bleiben in diesem Tab.',
  'ask.conversation': 'Unterhaltung: Fragen zu Timo',
  'ask.newChat': 'Neuer Chat',
  'ask.wait': 'Ich schaue nach…',
  'ask.offline':
    'Da ist beim Nachschauen etwas schiefgelaufen. Versuch es gleich noch einmal.',
  'ask.partial': 'Die Quellen belegen nur einen Teil der Antwort.',
  'ask.related': 'Passende Information von der Website.',
  'ask.seePage':
    'Dieses Detail finde ich gerade nicht. Hier kannst du weiterlesen.',
  'ask.missingSubject':
    'Dieses Detail zu {subject} steht dort nicht. Hier ist die Seite, um die es gerade ging.',
  'ask.spec': 'Für {subject} ist bei {spec} {value} angegeben.',
  'ask.missing': 'In diesen Auszügen bleibt offen: „{detail}“',
  'ask.length': 'Gib eine Frage mit 1–500 Zeichen ein.',
  'ask.limited': 'Zu viele Fragen. Versuche es gleich noch einmal.',
  'section.featured.all': 'Alle Projekte',
  'section.homelabTeaser.title': 'Das Homelab',
  'section.homelabTeaser.text': `Ein selbst gebauter Server mit ${STORAGE_TOTAL} Speicher, auf dem die Dienste laufen, die ich täglich nutze — inklusive dieser Website.`,
  'section.homelabTeaser.cta': 'Homelab erkunden',

  'projects.title': 'Projekte',
  'projects.intro':
    'Ich entwickle Software, die ich selbst nutzen möchte: für Hörstatistiken, Netzwerküberwachung und Spiele mit Freunden. Dazu kommen diese Website und frühere Abschlussarbeiten.',
  'project.source': 'Quellcode',
  'project.details': 'Mehr zum Projekt',
  'project.contribution': 'Mein Beitrag',
  'project.back': 'Alle Projekte',
  'project.story.problem': 'Ausgangslage',
  'project.story.contribution': 'Meine Umsetzung',
  'project.story.decisions': 'Technische Entscheidungen',
  'project.story.outcome': 'Das Ergebnis',
  'project.upstream': 'Ursprüngliches Projekt',
  'project.screenshots': 'Einblicke ins Projekt',
  'project.screenshots.open': 'Bild in voller Größe öffnen',
  'project.visit': 'Ansehen',
  'project.status.active': 'aktiv',
  'project.status.archived': 'archiviert',
  'project.status.fork': 'Fork',

  'homelab.intro':
    'Zur Software gehört auch die Infrastruktur, auf der sie läuft: ein selbst gebauter Server im Wohnzimmer statt einer fremden Cloud.',
  'homelab.machine.server': 'Server',
  'homelab.machine.workstation': 'Workstation',
  'homelab.machine.devserver': 'Dev-Server',
  'homelab.machine.server.role':
    'Läuft rund um die Uhr: hostet diese Seite und alle Dienste',
  'homelab.machine.workstation.role':
    'Alltagsrechner: Entwickeln, Gaming, lokale KI',
  'homelab.machine.devserver.role':
    'Spielwiese: Experimente, Builds, Testumgebungen',
  'homelab.hw.ram': 'RAM',
  'homelab.hw.board': 'Mainboard',
  'homelab.hw.network': 'Netzwerk',
  'homelab.hw.storage': 'Speicher',
  'homelab.hw.storage.value': `${STORAGE_TOTAL} auf 10 Platten`,
  'homelab.hw.storage.workstation': '3 TB SSD',
  'homelab.hw.storage.devserver': '1,25 TB SSD · 6 TB HDD',
  'homelab.services.title': 'Laufende Dienste',
  'homelab.services.note':
    'Die Dienste werden alle paar Minuten direkt aus dem Homelab geprüft. Liegen keine aktuellen Messdaten vor, wird der Status als unbekannt angezeigt.',
  'homelab.why.title': 'Warum Self-Hosting?',
  'homelab.why.text':
    'Dienste selbst zu betreiben heißt, den ganzen Stack zu verstehen — DNS, TLS, Reverse Proxies, Backups, Monitoring — und aus abstrakten Cloud-Konzepten wird Hardware, die man anfassen kann. Meine Daten bleiben dabei auf meiner eigenen Hardware – und ich kann selbst entscheiden, wie ich sie nutze und auswerte.',
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
  'status.unknown': 'unbekannt',
  'status.asOf': 'Stand: {time}',
  'services.count': '{total} Dienste',
  'services.summaryLive':
    '{total} Dienste · {online} online · geprüft um {time}',
  'service.badge.own': 'mein Projekt',
  'service.badge.contributor': 'mitentwickelt',

  'about.title': 'Über mich',
  'about.intro':
    'Ich bin Softwareentwickler, wohne in der Schweiz und komme ursprünglich aus der Bodenseeregion. Ich baue am liebsten Software, die anderen Arbeit abnimmt — von der automatischen Belegverarbeitung in einem großen ERP-System bis zu den C#-Plug-ins aus meinen Praktika. Mich reizt der ganze Weg: einen verworrenen Ablauf verstehen, ihn sauber abbilden und daraus etwas machen, das sich gut warten lässt. Am meisten lerne ich in der Praxis: in eigenen Projekten, mit Open-Source-Beiträgen wie zu MySpeed und in meinem Homelab, auf dem auch diese Seite läuft.',
  'about.experience.title': 'Berufserfahrung',
  'about.education.title': 'Ausbildung',
  'about.languages.title': 'Sprachen',
  'about.present': 'heute',
  'about.qualifications.title': 'Zertifikate & Kurse',
  'contact.cv.en': 'Lebenslauf auf Englisch · PDF',
  'contact.cv.de': 'Lebenslauf auf Deutsch · PDF',

  'lang.switch.label': 'Switch to English',
  'lang.switch.code': 'EN',
  'a11y.toggleTheme': 'Farbschema wechseln',
  'a11y.mainNav': 'Hauptnavigation',
  'a11y.email': 'E-Mail',

  'footer.selfHosted': 'Selbst gehostet auf eigener Hardware',
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
  'homelab.hw.gpu',
  'homelab.hw.os',
  'status.online',
  'services.groupOnline',
  'about.skills.title',
];

export const ui: {
  en: Record<UIKey, string>;
  de: Partial<Record<UIKey, string>>;
} = { en, de };
