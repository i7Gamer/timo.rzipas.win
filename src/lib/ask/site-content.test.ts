import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { Window } from 'happy-dom';
import { describe, expect, it, vi } from 'vitest';
import { extractPage, writeSiteContent } from '../../../scripts/ask-content';
import AskWork from '../../components/AskWork.astro';
import ProjectStory from '../../components/ProjectStory.astro';
import { PROJECTS } from '../../data/projects';
import TimelineItem from '../../components/TimelineItem.astro';
import { PROJECT_AI_NOTES } from '../../data/project-ai';
import { setupAskWork } from './browser';
import { documentAnswer, facts, sourceLink } from './catalog';
import routing from '../../../tests/ask/routing.json';
import {
  approvedAnswers,
  approvedExpectation,
} from '../../../tests/ask/approved-expectations';
import { questionLocale, socialReply, unknownReply } from './conversation';
import { corpusVersion } from './version';
import {
  findSiteContent,
  namesSiteSubject,
  parseSiteContent,
  resolveSiteNames,
  SITE_CONTENT_PATH,
  type SiteContent,
} from './site-content';

const homelab = `<!doctype html><html lang="en">
  <head><title>Homelab · Portfolio</title></head>
  <body><nav>Navigation text</nav><main>
    <h1>Homelab</h1><p data-ask-overview>I self-host this website on a server I built.</p>
    <h2>Hardware</h2><h3>Server</h3><p>CPU Intel i5-13500</p><h3>Workstation</h3>
    <p>Daily driver for coding and local AI</p>
    <p class="grid"><span>Memory</span><span>32 GB DDR5</span></p>
    <p class="grid"><span>GPU</span><span>NVIDIA RTX 5090</span></p>
    <p>CPU Intel i7-13700K</p>
    <h3>Dev-Server</h3><p>GPU AMD Radeon</p>
    <h2>Monitoring</h2>
    <details><summary><h3>Operations</h3><span>1 service</span></summary>
    <article><h4>Grafana</h4><span data-status-label>Current status</span><p>Dashboards show temperatures &amp; traffic.</p></article></details>
    <h3>Local AI</h3><h4>Local LLM</h4><p>Local language model inference at home.</p>
    <h4>Open WebUI</h4><p>Chat interface for the local models.</p>
    <section data-ask-exclude><p>Ask example</p></section>
    <p hidden>Hidden status</p><script>ignoredScript()</script>
  </main><footer>Footer text</footer></body></html>`;

const website = `<main><h1>This Website</h1><h2>Build and delivery</h2>
  <p>GitHub Actions builds a Docker image for this website.</p>
  <p>Astro creates the public pages in English and German.</p></main>`;
const tracker = `<main><h1>SpotifyTracker</h1><p>← All projects</p>
  <p>Self-hosted Spotify history for multiple users.</p>
  <h2>What I built</h2><p>I rewrote the tracker using Python, Flask and SQLite.</p>
  <h2>Engineering decisions</h2><p>Reconciliation keeps the live listener and Spotify backfill from counting the same play twice.</p></main>`;
const hearthcoil =
  '<main><h1>Hearthcoil</h1><p>A couch co-op game in Unity.</p><h2>What I built</h2><p>I worked on combat. I built a supervisor and dashboard for coordinating coding-agent work.</p></main>';

function index() {
  return parseSiteContent(
    {
      locale: 'en',
      pages: [
        extractPage(website, '/'),
        extractPage(homelab, '/homelab/'),
        extractPage(website, '/projects/this-website/'),
        extractPage(tracker, '/projects/spotify-stats-tracker/'),
        extractPage(hearthcoil, '/projects/hearthcoil/'),
      ],
    },
    'en',
  )!;
}

describe('Ask public page content', () => {
  it('uses the same reviewed project summary offline after a typo', () => {
    const content = index();
    content.pages.push(
      extractPage(
        '<main><h1>MySpeed</h1><p>Network monitoring.</p></main>',
        '/projects/myspeed/',
      ),
      extractPage(
        '<main><h1>Tutto</h1><p>A dice game.</p></main>',
        '/projects/tutto/',
      ),
    );
    const expected = findSiteContent(
      'summarize all projects',
      content,
      'overview',
    );
    expect(expected).toMatchObject({ status: 'answer', preferModel: true });
    expect(expected?.sources.map(({ href }) => href)).toEqual([
      '/projects/spotify-stats-tracker/',
      '/projects/myspeed/',
      '/projects/tutto/',
    ]);
    expect(
      findSiteContent('sumamrize all projects', content, 'overview'),
    ).toEqual(expected);
    expect(
      findSiteContent('sumamrize all proejcts', content, 'overview'),
    ).toEqual(expected);
  });

  it('renders accessible toolbar contrast classes and the Spotify anchor with sticky offset', async () => {
    const container = await AstroContainer.create();
    const askHtml = await container.renderToString(AskWork, {
      props: { locale: 'en' },
    });
    const window = new Window();
    try {
      window.document.body.innerHTML = askHtml;
      const icons = Array.from(
        window.document.querySelectorAll('[data-ask-window-tools] svg'),
      );
      expect(icons).toHaveLength(2);
      expect(icons.map((icon) => icon.getAttribute('class'))).toEqual([
        expect.stringContaining('dark:text-red-400/90'),
        expect.stringContaining('dark:text-emerald-400/90'),
      ]);
      expect(
        window.document.querySelectorAll(
          '[data-ask-window-tools] button[aria-label]',
        ),
      ).toHaveLength(2);

      const spotify = PROJECTS.find(
        ({ slug }) => slug === 'spotify-stats-tracker',
      )!;
      const storyHtml = await container.renderToString(ProjectStory, {
        props: { project: spotify as Required<typeof spotify>, locale: 'en' },
      });
      window.document.body.innerHTML = storyHtml;
      expect(
        window.document.querySelector('#contribution')?.className,
      ).toContain('scroll-mt-24');
    } finally {
      window.close();
    }
  });
  it.each([
    [
      'en',
      'How is this website hosted?',
      'What languages does Timo speak?',
      'Who won the World Cup?',
    ],
    [
      'de',
      'Wie wird diese Website gehostet?',
      'Welche Sprachen spricht Timo?',
      'Wer gewann die Fussball-WM?',
    ],
  ] as const)(
    'keeps reviewed clause coverage in the offline %s index',
    (locale, hosting, languages, unrelated) => {
      const content = { ...index(), locale };
      content.pages.push(
        extractPage(
          '<main><h1>About</h1><p>Portfolio profile.</p></main>',
          '/about/',
        ),
      );
      expect(
        findSiteContent(`${hosting} ${unrelated}`, content, 'overview'),
      ).toMatchObject({
        status: 'partial',
        note: expect.stringMatching(/unanswered|bleibt offen/),
        sources: [{ href: '/projects/this-website/' }],
      });
      expect(
        findSiteContent(`${hosting} ${languages}`, content, 'overview'),
      ).toMatchObject({
        status: 'answer',
        missing: [],
        sources: [{ href: '/projects/this-website/' }, { href: '/about/' }],
      });
      expect(
        findSiteContent(
          `${unrelated} ${locale === 'de' ? 'Wie alt ist der Mond?' : 'How old is the moon?'}`,
          content,
          'overview',
        ),
      ).toBeNull();
    },
  );

  it.each([
    ['en', 'Which project used Flask and who won the World Cup?'],
    ['en', 'Which project used Flask? Did Timo invent Flask?'],
    ['de', 'Welches Projekt nutzte Flask und wer gewann die Fussball-WM?'],
    ['de', 'Wofür hat Timo Flask eingesetzt? Hat er Flask erfunden?'],
  ] as const)(
    'keeps only the supported Flask clause in the offline index for %s',
    (locale, question) => {
      const answer = findSiteContent(
        question,
        { ...index(), locale },
        'overview',
      );
      expect(answer).toMatchObject({
        status: 'partial',
        note: expect.stringMatching(/unanswered|bleibt offen/),
        sources: [{ href: '/projects/spotify-stats-tracker/#contribution' }],
      });
    },
  );

  it.each([
    ['en', 'How is this website hosted? What do you work on at Abacus?'],
    [
      'de',
      'Wie wird diese Website gehostet und woran arbeitet Timo bei Abacus?',
    ],
  ] as const)(
    'combines both supported offline clauses in %s',
    (locale, question) => {
      const content = { ...index(), locale };
      content.pages.push(extractPage('<main><h1>About</h1></main>', '/about/'));
      expect(findSiteContent(question, content, 'overview')).toMatchObject({
        status: 'answer',
        missing: [],
        sources: [
          { href: '/projects/this-website/' },
          { href: '/about/#abacus' },
        ],
      });
    },
  );
  const careerOverview = 'Give me a summary of his work experience';
  const abacusRole = 'What do you work on at Abacus?';
  it('recognises a German request for more in an English chat', () => {
    expect(questionLocale('Noch mehr?', 'en')).toBe('de');
  });

  it('keeps German project follow-ups on projects when the gateway goes offline', async () => {
    const window = new Window();
    try {
      vi.stubGlobal('document', window.document);
      window.document.documentElement.lang = 'de';
      const content = { ...index(), locale: 'de' };
      for (const path of [
        'myspeed',
        'tutto',
        'bachelor-thesis',
        'carini-management-system',
      ]) {
        content.pages.push(
          extractPage(`<main><h1>${path}</h1></main>`, `/projects/${path}/`),
        );
      }
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>(async (path, init) => {
          if (path === '/ask-content-de.json') return Response.json(content);
          if (JSON.parse(String(init?.body)).question === 'projekte')
            return Response.json(
              documentAnswer(
                ['spotify-rewrite', 'myspeed-fork', 'tutto-modes'].map((id) =>
                  facts.find((fact) => fact.id === id)!,
                ),
                'answer',
                'local',
                'de',
                corpusVersion,
              ),
            );
          return new Response(null, { status: 503 });
        }),
      );
      window.document.body.innerHTML = `<section data-mode="local" data-version="${corpusVersion}" data-messages="{}"><div data-ask-result></div><div data-ask-actions></div><form><textarea></textarea><button type="submit">Ask</button></form></section>`;
      const panel = window.document.querySelector('section')!;
      setupAskWork(panel as unknown as HTMLElement);
      for (const [index, question] of [
        'yo',
        'projekte',
        'mehr',
        'mehr zu projekten',
      ].entries()) {
        panel.querySelector('textarea')!.value = question;
        panel.querySelector('form')!.dispatchEvent(new window.Event('submit'));
        await vi.waitFor(() => {
          expect(panel.querySelectorAll('[data-ask-reply]')).toHaveLength(
            index + 1,
          );
          expect(panel.querySelector('button')!.disabled).toBe(false);
        });
      }
      const [, overview, next, exhausted] =
        panel.querySelectorAll('[data-ask-reply]');
      expect(
        overview.querySelector('a[href="/projects/tutto/"]'),
      ).not.toBeNull();
      expect(
        next.querySelector('a[href="/projects/hearthcoil/"]'),
      ).not.toBeNull();
      expect(next.textContent).not.toContain('SpotifyTracker');
      expect(exhausted.textContent).toContain(
        'Über welches Projekt möchtest du mehr erfahren?',
      );
      expect(exhausted.querySelector('a[href^="/about/"]')).toBeNull();
    } finally {
      vi.unstubAllGlobals();
      window.close();
    }
  });

  it('uses the page index for other projects when the gateway stays offline', async () => {
    const window = new Window();
    try {
      vi.stubGlobal('document', window.document);
      const content = index();
      content.pages.push(
        extractPage(
          '<main><h1>Projects</h1><p data-ask-overview>Self-hosted Spotify history for multiple users.</p></main>',
          '/projects/',
        ),
      );
      const lookup = vi.fn<typeof fetch>(async (path) =>
        path === '/ask-content-en.json' || path === '/ask-content-en.json'
          ? Response.json(content)
          : new Response(null, { status: 503 }),
      );
      vi.stubGlobal('fetch', lookup);
      window.document.documentElement.lang = 'en';
      window.document.body.innerHTML =
        '<section data-mode="local" data-version="fixture" data-messages="{}"><div data-ask-result></div><div data-ask-actions></div><form><textarea></textarea><button type="submit">Ask</button></form></section>';
      const panel = window.document.querySelector('section')!;
      setupAskWork(panel as unknown as HTMLElement);
      for (const [question, expected] of [
        ['projects?', 'Self-hosted Spotify'],
        ['anything more?', 'or other projects?'],
        ['Other projects', 'Hearthcoil'],
      ]) {
        panel.querySelector('textarea')!.value = question;
        panel.querySelector('form')!.dispatchEvent(new window.Event('submit'));
        await vi.waitFor(() =>
          expect(
            panel.querySelector('[data-ask-reply]:last-child')?.textContent,
          ).toContain(expected),
        );
      }
      const listedReply = panel.querySelector('[data-ask-reply]:last-child')!;
      expect(
        listedReply.querySelector('a[href="/projects/hearthcoil/"]'),
      ).not.toBeNull();
      panel.querySelector('textarea')!.value = 'Tell me more';
      panel.querySelector('form')!.dispatchEvent(new window.Event('submit'));
      await vi.waitFor(() =>
        expect(
          panel.querySelector('[data-ask-reply]:last-child')?.textContent,
        ).toContain('Hearthcoil'),
      );
      expect(
        panel.querySelector('[data-ask-reply]:last-child')?.textContent,
      ).not.toContain('SpotifyTracker');
    } finally {
      vi.unstubAllGlobals();
      window.close();
    }
  });

  it('does not show the same project excerpt for a second request for more', () => {
    const content = index();
    const subject = {
      href: '/projects/spotify-stats-tracker/',
      label: 'SpotifyTracker',
    };
    const earlier = findSiteContent('more?', content, 'related', subject);
    const excerpt = earlier!.sources[0].excerpts[0];
    expect(excerpt).toContain('Reconciliation');
    const next = findSiteContent('more?', content, 'related', subject, [
      { question: 'more?', answer: excerpt },
    ]);
    expect(next?.sources.flatMap(({ excerpts }) => excerpts)).not.toContain(
      excerpt,
    );
  });

  it.each([
    [
      'en',
      'Anything that did not work out? Any holes in his CV?',
      'The public CV does not establish',
    ],
    [
      'de',
      'Was hat bei seinen Projekten nicht funktioniert? Lücken im Lebenslauf?',
      'geht aus dem öffentlichen Lebenslauf nicht hervor',
    ],
  ] as const)(
    'shows which part of a reviewed %s answer is missing online and offline',
    async (locale, question, note) => {
      const page = extractPage(tracker, '/projects/spotify-stats-tracker/');
      const claim = facts.find(({ id }) => id === 'spotify-upstream-review')!;
      for (const online of [true, false]) {
        const window = new Window();
        try {
          vi.stubGlobal('document', window.document);
          const lookup = vi.fn<typeof fetch>(async (path) =>
            path === '/api/ask'
              ? online
                ? Response.json(
                    documentAnswer(
                      [claim],
                      'partial',
                      'index',
                      locale,
                      'fixture',
                      'cv-gaps',
                    ),
                  )
                : new Response(null, { status: 503 })
              : online
                ? new Response(null, { status: 503 })
                : Response.json({ locale, pages: [page] }),
          );
          vi.stubGlobal('fetch', lookup);
          window.document.documentElement.lang = locale;
          window.document.body.innerHTML =
            '<section data-mode="local" data-version="fixture" data-messages="{}"><div data-ask-result></div><form><textarea></textarea><button type="submit">Ask</button></form></section>';
          const panel = window.document.querySelector('section')!;
          setupAskWork(panel as unknown as HTMLElement);
          panel.querySelector('textarea')!.value = question;
          panel
            .querySelector('form')!
            .dispatchEvent(new window.Event('submit'));
          await vi.waitFor(() => {
            const reply = panel.querySelector('[data-ask-reply]');
            expect(reply?.textContent).toContain(note);
            expect(reply?.textContent).toContain(claim.answer[locale]);
            expect(reply?.querySelector('a')?.getAttribute('href')).toBe(
              '/projects/spotify-stats-tracker/#upstream-import',
            );
          });
          expect(lookup.mock.calls.some(([path]) => path === '/api/ask')).toBe(
            online,
          );
        } finally {
          vi.unstubAllGlobals();
          window.close();
        }
      }
    },
  );

  it('recognises the language of portfolio requests on either site', () => {
    expect(
      questionLocale('Nenn mir ein spannendes Detail über Timo', 'en'),
    ).toBe('de');
    expect(questionLocale('Short pitch about Timo', 'de')).toBe('en');
    expect(questionLocale('Arbeit', 'en')).toBe('de');
    expect(questionLocale('Mehr über die Arbeit', 'en')).toBe('de');
    expect(questionLocale('Work', 'de')).toBe('en');
    expect(questionLocale('Länger bitte', 'en')).toBe('de');
    expect(questionLocale('Longer', 'de')).toBe('en');
    expect(questionLocale('sumamrize all proejcts', 'de')).toBe('en');
    expect(questionLocale('Zusamenfassung seiner Projetke', 'en')).toBe('de');
  });

  it.each([
    ['Other projects', 'Hearthcoil', 200],
    ['SpotifyTracker', 'Reconciliation keeps', 200],
    ['this project', 'Reconciliation keeps', 200],
    ['this project', 'Reconciliation keeps', 503],
    ['Other projects', 'Hearthcoil', 429],
  ])(
    'lets visitors resolve the project clarification with %s (%s, HTTP %s)',
    async (choice, expected, status) => {
      const window = new Window();
      try {
        vi.stubGlobal('document', window.document);
        window.document.documentElement.lang = 'en';
        const content = index();
        content.pages.push(
          extractPage(
            '<main><h1>Projects</h1><p data-ask-overview>Self-hosted Spotify history for multiple users.</p></main>',
            '/projects/',
          ),
        );
        const requests: string[] = [];
        const lookup = vi.fn<typeof fetch>(async (path, options) => {
          if (path === '/ask-content-en.json') return Response.json(content);
          const { question } = JSON.parse(String(options?.body));
          requests.push(question);
          if (question === 'anything more?') {
            if (status !== 200) return new Response(null, { status });
            return Response.json({
              ...documentAnswer([], 'unknown', 'local', 'en', 'fixture'),
              clarifyProject: 'spotify-rewrite',
            });
          }
          const selected = facts.filter(({ id }) => id === 'hearthcoil-game');
          return Response.json(
            documentAnswer(selected, 'answer', 'local', 'en', 'fixture'),
          );
        });
        vi.stubGlobal('fetch', lookup);
        window.document.body.innerHTML =
          '<section data-mode="local" data-version="fixture"><div data-ask-result></div><div data-ask-actions></div><form><textarea></textarea><button type="submit">Ask</button></form></section>';
        const panel = window.document.querySelector('section')!;
        panel.dataset.messages = JSON.stringify({ wait: 'Looking...' });
        setupAskWork(panel as unknown as HTMLElement);
        for (const [prompt, answer] of [
          ['projects?', 'Self-hosted Spotify'],
          [
            'anything more?',
            'Do you mean more about SpotifyTracker, or other projects?',
          ],
          [choice, expected],
        ]) {
          panel.querySelector('textarea')!.value = prompt;
          panel
            .querySelector('form')!
            .dispatchEvent(new window.Event('submit'));
          await vi.waitFor(() =>
            expect(
              panel.querySelector('[data-ask-reply]:last-child')?.textContent,
            ).toContain(answer),
          );
        }
        expect(requests).toEqual(
          choice === 'Other projects'
            ? ['anything more?', choice]
            : ['anything more?'],
        );
      } finally {
        vi.unstubAllGlobals();
        window.close();
      }
    },
  );

  it.each([
    ['de', 'en', 'Was the Spotify tracker an original project or a rewrite?'],
    [
      'en',
      'de',
      'War SpotifyTracker ein eigenes Projekt oder eine Neuentwicklung?',
    ],
  ] as const)(
    'answers the %s site’s %s Spotify rewrite question in the question language',
    async (siteLocale, locale, question) => {
      const window = new Window();
      try {
        vi.stubGlobal('document', window.document);
        window.document.documentElement.lang = siteLocale;
        const evidence = facts.filter(({ id }) => id === 'spotify-rewrite');
        const lookup = vi.fn<typeof fetch>(async (path) => {
          if (
            path === '/ask-content-en.json' ||
            String(path).startsWith('/ask-content-')
          ) {
            return Response.json({ ...index(), locale });
          }
          return Response.json(
            documentAnswer(evidence, 'answer', 'index', locale, 'fixture'),
          );
        });
        vi.stubGlobal('fetch', lookup);
        window.document.body.innerHTML =
          '<section data-mode="local" data-version="fixture"><div data-ask-result></div><form><textarea></textarea><button type="submit">Ask</button></form></section>';
        const panel = window.document.querySelector('section')!;
        panel.dataset.messages = JSON.stringify({ wait: 'Looking...' });
        setupAskWork(panel as unknown as HTMLElement);
        panel.querySelector('textarea')!.value = question;
        panel.querySelector('form')!.dispatchEvent(new window.Event('submit'));
        await vi.waitFor(() => {
          const reply = panel.querySelector('[data-ask-reply]');
          expect(reply?.textContent).toContain(evidence[0].answer[locale]);
          expect(reply?.getAttribute('lang')).toBe(locale);
        });
        expect(lookup).toHaveBeenCalledWith(
          '/ask-content-' + locale + '.json',
          expect.any(Object),
        );
      } finally {
        vi.unstubAllGlobals();
        window.close();
      }
    },
  );

  it.each([
    ['Who won the World Cup?', unknownReply('en', 0)],
    ['Tell me about Widget', 'Read the portfolio page'],
  ])(
    'waits for the gateway before showing a fallback for %s',
    async (question, expected) => {
      const window = new Window();
      try {
        vi.stubGlobal('document', window.document);
        window.document.documentElement.lang = 'en';
        const content = index();
        content.pages.push(
          extractPage('<main><h1>Widget</h1></main>', '/projects/widget/'),
        );
        const reply = Promise.withResolvers<Response>();
        const lookup = vi.fn<typeof fetch>(async (path) =>
          path === '/ask-content-en.json'
            ? Response.json(content)
            : reply.promise,
        );
        vi.stubGlobal('fetch', lookup);
        window.document.body.innerHTML =
          '<section data-mode="local" data-version="fixture"><div data-ask-result></div><form><textarea></textarea><button type="submit">Ask</button></form></section>';
        const panel = window.document.querySelector('section')!;
        panel.dataset.messages = JSON.stringify({
          wait: 'Looking…',
          seePage: 'Read the portfolio page',
        });
        setupAskWork(panel as unknown as HTMLElement);
        panel.querySelector('textarea')!.value = question;
        panel.querySelector('form')!.dispatchEvent(new window.Event('submit'));
        await vi.waitFor(() =>
          expect(lookup).toHaveBeenCalledWith('/api/ask', expect.any(Object)),
        );
        expect(panel.querySelector('[data-ask-reply]')?.textContent).toBe(
          'Looking…',
        );
        reply.resolve(
          Response.json(
            documentAnswer([], 'unknown', 'local', 'en', 'fixture'),
          ),
        );
        await vi.waitFor(() =>
          expect(
            panel.querySelector('[data-ask-reply]')?.textContent,
          ).toContain(expected),
        );
      } finally {
        vi.unstubAllGlobals();
        window.close();
      }
    },
  );

  it.each([
    {
      title: 'keeps the pet group and the last named cat in context',
      turns: [
        ['pets?', 'Timo has three cats.'],
        ['what are their names?', 'Rudi, Georgi and Benji'],
        ['names?', 'Rudi, Georgi and Benji'],
        ['are they all male?', 'All three of Timo’s cats are male.'],
        ['sind sie alle männlich?', 'Alle drei Katzen von Timo sind männlich.'],
        ['georgi color?', 'Georgi is a brown rosetted Bengal.'],
        ['color of the other 2', 'Rudi is a black domestic cat.'],
      ],
      final: 'Benji is a Bengal with a silver-grey coat',
      excluded: /Georgi/,
      links: [],
    },
    {
      title:
        'uses the chosen open-source project for bare language questions and corrections',
      turns: [
        ['opensource', 'MySpeed'],
        ['anything else', 'MySpeed or SpotifyTracker?'],
        ['myspeed', 'React'],
        ['language?', 'MySpeed is written in JavaScript.'],
        ['myspeed i mean', 'MySpeed is written in JavaScript.'],
      ],
      final: 'Node.js',
      excluded: /homelab|static Astro/i,
      links: ['/projects/myspeed/'],
    },
  ])('$title', async ({ turns, final, excluded, links }) => {
    const window = new Window();
    try {
      vi.stubGlobal('document', window.document);
      window.document.documentElement.lang = 'en';
      const content = index();
      content.pages.push(
        extractPage(
          '<main><h1>MySpeed</h1><h2>Engineering decisions</h2><p>The React frontend talks to Express.</p><h2>The result</h2><p>Compare network targets.</p></main>',
          '/projects/myspeed/',
        ),
      );
      const fetchContent = vi.fn<typeof fetch>(async (path) =>
        path === '/ask-content-en.json'
          ? Response.json(content)
          : path === '/ask-content-de.json'
            ? Response.json({ ...content, locale: 'de' })
            : new Response(null, { status: 503 }),
      );
      vi.stubGlobal('fetch', fetchContent);
      window.document.body.innerHTML =
        '<section data-mode="local" data-version="fixture"><div data-ask-result></div><form><textarea></textarea><button type="submit">Ask</button></form></section>';
      const panel = window.document.querySelector('section')!;
      panel.dataset.messages = JSON.stringify({
        wait: 'Looking…',
        related: 'Related detail',
      });
      const textarea = panel.querySelector('textarea')!;
      const form = panel.querySelector('form')!;
      const latest = () => panel.querySelector('[data-ask-reply]:last-child')!;
      setupAskWork(panel as unknown as HTMLElement);
      for (const [question, expected] of turns) {
        textarea.value = question;
        form.dispatchEvent(new window.Event('submit'));
        await vi.waitFor(() =>
          expect(latest().textContent).toContain(expected),
        );
      }
      expect(latest().textContent).toContain(final);
      expect(latest().textContent).not.toMatch(excluded);
      expect(
        Array.from(latest().querySelectorAll('a'), (anchor) =>
          anchor.getAttribute('href'),
        ),
      ).toEqual(links);
      expect(
        fetchContent.mock.calls.every(([path]) => path !== '/api/ask'),
      ).toBe(true);
    } finally {
      vi.unstubAllGlobals();
      window.close();
    }
  });

  it.each([
    ['other experience?', 'en', careerOverview, 'carini-dates'],
    ['different jobs?', 'en', careerOverview, 'carini-dates'],
    ['anything else?', 'en', careerOverview, 'carini-dates'],
    ['Andere Jobs?', 'de', careerOverview, 'carini-dates'],
    ['Tell me more', 'en', abacusRole, 'abacus-tests'],
    ['Other roles', 'en', abacusRole, 'tutoring'],
  ] as const)(
    'sends the career follow-up %s and the previous reply to the gateway',
    async (question, locale, initialQuestion, factId) => {
      const window = new Window();
      try {
        vi.stubGlobal('document', window.document);
        window.document.documentElement.lang = 'en';
        const content = index();
        content.pages.push(
          extractPage(
            '<main><h1>About</h1><h2>Experience</h2><h3>Software Engineer · Abacus</h3><p>Java and Vaadin document workflows.</p></main>',
            '/about/',
          ),
        );
        const abacus = facts.find(({ id }) => id === 'abacus-workflow')!;
        const detail = facts.find(({ id }) => id === factId)!;
        const lookup = vi.fn<typeof fetch>(async (path, options) => {
          if (path === '/ask-content-en.json') return Response.json(content);
          if (path === '/ask-content-de.json')
            return Response.json({ ...content, locale: 'de' });
          const input = JSON.parse(String(options?.body));
          const selected =
            input.question === initialQuestion ? [abacus] : [detail];
          return Response.json(
            documentAnswer(
              selected,
              'answer',
              'local',
              input.locale,
              'fixture',
            ),
          );
        });
        vi.stubGlobal('fetch', lookup);
        window.document.body.innerHTML =
          '<section data-mode="local" data-version="fixture"><div data-ask-result></div><form><textarea></textarea><button type="submit">Ask</button></form></section>';
        const panel = window.document.querySelector('section')!;
        panel.dataset.messages = JSON.stringify({ wait: 'Looking...' });
        setupAskWork(panel as unknown as HTMLElement);
        for (const [prompt, expected] of [
          [initialQuestion, abacus.answer.en],
          [question, detail.answer[locale]],
        ]) {
          panel.querySelector('textarea')!.value = prompt;
          panel
            .querySelector('form')!
            .dispatchEvent(new window.Event('submit'));
          await vi.waitFor(() =>
            expect(
              panel.querySelector('[data-ask-reply]:last-child')?.textContent,
            ).toContain(expected),
          );
        }
        expect(lookup).toHaveBeenCalledWith(
          '/api/ask',
          expect.objectContaining({
            body: JSON.stringify({
              question,
              locale,
              history: [
                { question: initialQuestion, answer: abacus.answer.en },
              ],
            }),
          }),
        );
      } finally {
        vi.unstubAllGlobals();
        window.close();
      }
    },
  );

  it.each([
    ['Mehr Details über seine Katzen', 'about.cats.rudi', 'schwarze Hauskatze'],
    [
      'Gib mir eine Zusammenfassung seiner Berufserfahrung',
      'abacus-workflow',
      'Java/Vaadin-Workflow',
    ],
    [
      'Fass Timos Berufserfarung zusammen',
      'abacus-workflow',
      'Java/Vaadin-Workflow',
    ],
  ])(
    'takes %s to the agent from a fresh English chat',
    async (question, factId, answer) => {
      const window = new Window();
      try {
        vi.stubGlobal('document', window.document);
        window.document.documentElement.lang = 'en';
        const content = index();
        content.pages.push(
          extractPage('<main><h1>About</h1></main>', '/about/'),
        );
        const local = { ...content, locale: 'de' };
        const selected = facts.filter(({ id }) => id === factId);
        const lookup = vi.fn<typeof fetch>(async (path) =>
          path === '/ask-content-de.json'
            ? Response.json(local)
            : Response.json(
                documentAnswer(selected, 'answer', 'local', 'de', 'fixture'),
              ),
        );
        vi.stubGlobal('fetch', lookup);
        window.document.body.innerHTML =
          '<section data-mode="local" data-version="fixture"><div data-ask-result></div><form><textarea></textarea><button type="submit">Ask</button></form></section>';
        const panel = window.document.querySelector('section')!;
        panel.dataset.messages = JSON.stringify({ wait: 'Looking...' });
        setupAskWork(panel as unknown as HTMLElement);
        panel.querySelector('textarea')!.value = question;
        panel.querySelector('form')!.dispatchEvent(new window.Event('submit'));
        await vi.waitFor(() =>
          expect(
            panel.querySelector('[data-ask-reply]')?.textContent,
          ).toContain(answer),
        );
        expect(lookup).toHaveBeenCalledWith(
          '/api/ask',
          expect.objectContaining({
            body: JSON.stringify({
              question,
              locale: 'de',
            }),
          }),
        );
      } finally {
        vi.unstubAllGlobals();
        window.close();
      }
    },
  );

  it('links a reviewed catalogue PDF', async () => {
    const window = new Window();
    try {
      vi.stubGlobal('document', window.document);
      window.document.documentElement.lang = 'en';
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => Response.json(index())),
      );
      window.document.body.innerHTML =
        '<section data-mode="local" data-version="fixture"><div data-ask-result></div><form><textarea></textarea><button type="submit">Ask</button></form></section>';
      const panel = window.document.querySelector('section')!;
      panel.dataset.messages = JSON.stringify({ wait: 'Looking...' });
      setupAskWork(panel as unknown as HTMLElement);
      panel.querySelector('textarea')!.value =
        'What was the title of Timo’s bachelor thesis?';
      panel.querySelector('form')!.dispatchEvent(new window.Event('submit'));
      await vi.waitFor(() => {
        const reply = panel.querySelector('[data-ask-reply]')!;
        expect(
          reply.querySelector(
            'a[href="/downloads/timo-rzipa-bachelor-thesis.pdf#page=1"]',
          ),
        ).toBeTruthy();
        expect(reply.querySelector('[data-ask-attribution]')).toBeNull();
      });
    } finally {
      vi.unstubAllGlobals();
      window.close();
    }
  });

  it.each([
    [
      'How much faster is SpotifyTracker’s Compare view when sorting?',
      'https://github.com/i7Gamer/SpotifyTracker/pull/44',
    ],
  ])('shows a text-only source for %s', async (question, href) => {
    const window = new Window();
    try {
      vi.stubGlobal('document', window.document);
      window.document.documentElement.lang = 'en';
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => Response.json(index())),
      );
      window.document.body.innerHTML =
        '<section data-mode="local" data-version="fixture"><div data-ask-result></div><form><textarea></textarea><button type="submit">Ask</button></form></section>';
      const panel = window.document.querySelector('section')!;
      panel.dataset.messages = JSON.stringify({ wait: 'Looking...' });
      setupAskWork(panel as unknown as HTMLElement);
      panel.querySelector('textarea')!.value = question;
      panel.querySelector('form')!.dispatchEvent(new window.Event('submit'));
      await vi.waitFor(() => {
        const reply = panel.querySelector('[data-ask-reply]')!;
        expect(reply.querySelector('[data-ask-attribution]')).toBeTruthy();
        expect(reply.querySelector('a[href="' + href + '"]')).toBeNull();
      });
    } finally {
      vi.unstubAllGlobals();
      window.close();
    }
  });

  it.each([false, true])(
    'shows unlinked pet attribution (gateway fallback: %s)',
    async (gatewayFallback) => {
      const window = new Window();
      try {
        vi.stubGlobal('document', window.document);
        window.document.documentElement.lang = 'en';
        vi.stubGlobal(
          'fetch',
          vi.fn<typeof fetch>(async (path) => {
            if (path === '/ask-content-en.json')
              return gatewayFallback
                ? new Response(null, { status: 503 })
                : Response.json(index());
            const fact = facts.find(({ id }) => id === 'about.cats')!;
            return Response.json(
              documentAnswer([fact], 'answer', 'index', 'en', 'fixture'),
            );
          }),
        );
        window.document.body.innerHTML =
          '<section data-mode="local" data-version="fixture"><div data-ask-result></div><form><textarea></textarea><button type="submit">Ask</button></form></section>';
        const panel = window.document.querySelector('section')!;
        panel.dataset.messages = JSON.stringify({ wait: 'Looking...' });
        const input = panel.querySelector('textarea')!;
        setupAskWork(panel as unknown as HTMLElement);
        input.value = 'Does Timo have pets?';
        panel.querySelector('form')!.dispatchEvent(new window.Event('submit'));
        await vi.waitFor(() => {
          const reply = panel.querySelector('[data-ask-reply]')!;
          expect(reply.textContent).toContain('Timo has three cats.');
          expect(reply.querySelector('a')).toBeNull();
          expect(
            reply.querySelector('[data-ask-attribution]')?.textContent,
          ).toBe(sourceLink('portfolio-pets', 'en').label);
        });
      } finally {
        vi.unstubAllGlobals();
        window.close();
      }
    },
  );

  it.each([
    ['en', 'de', 'Woran arbeitet Timo gerade?', 'Stand 24. November 2026'],
    ['de', 'en', 'What is Timo currently doing?', 'As of 24 November 2026'],
  ] as const)(
    'uses the question language on the %s page',
    async (siteLocale, questionLocale, question, expected) => {
      const window = new Window();
      try {
        vi.stubGlobal('document', window.document);
        window.document.documentElement.lang = siteLocale;
        const pages = [extractPage('<main><h1>About</h1></main>', '/about/')];
        const fakeFetch = vi.fn<typeof fetch>(async (path) =>
          path === '/ask-content-' + questionLocale + '.json'
            ? Response.json({ locale: questionLocale, pages })
            : Response.json({ locale: siteLocale, pages }),
        );
        vi.stubGlobal('fetch', fakeFetch);
        window.document.body.innerHTML =
          '<section data-mode="local" data-version="fixture"><div data-ask-result></div><form><textarea></textarea><button type="submit">Ask</button></form></section>';
        const panel = window.document.querySelector('section')!;
        panel.dataset.messages = JSON.stringify({ wait: 'Looking…' });
        const textarea = panel.querySelector('textarea')!;
        setupAskWork(panel as unknown as HTMLElement);
        textarea.value = question;
        panel.querySelector('form')!.dispatchEvent(new window.Event('submit'));
        await vi.waitFor(() =>
          expect(
            panel.querySelector('[data-ask-reply]')?.textContent,
          ).toContain(expected),
        );
        expect(
          panel.querySelector('[data-ask-reply]')?.getAttribute('lang'),
        ).toBe(questionLocale);
        expect(
          panel.querySelector('[data-ask-reply] a')?.getAttribute('href'),
        ).toBe('/about/#current-work');
      } finally {
        vi.unstubAllGlobals();
        window.close();
      }
    },
  );

  it.each(['en', 'de'] as const)(
    'keeps the %s chat composer focused on conversation',
    async (locale) => {
      const container = await AstroContainer.create();
      const html = await container.renderToString(AskWork, {
        props: { locale },
      });
      const window = new Window();
      try {
        window.document.body.innerHTML = html;
        expect(
          window.document.querySelector('a[href*="timo-rzipa-cv"]'),
        ).toBeNull();
        expect(
          window.document.querySelector('label')?.getAttribute('for'),
        ).toBe('ask-question');
        expect(
          window.document
            .querySelector('textarea')
            ?.getAttribute('placeholder'),
        ).toBeTruthy();
        expect(
          window.document
            .querySelector('[data-ask-controls]')
            ?.hasAttribute('hidden'),
        ).toBe(true);
      } finally {
        window.close();
      }
    },
  );

  it.each([
    ['en', 'opensource'],
    ['en', 'tell me about opensource'],
    ['en', 'can you tell me about opensource?'],
    ['de', 'Open-Source-Beiträge'],
    ['de', 'kannst du mir was über opensource sagen?'],
  ] as const)(
    'renders both %s open-source contributions for %s',
    (locale, question) => {
      const content = index();
      content.locale = locale;
      content.pages.push(
        extractPage('<main><h1>MySpeed</h1></main>', '/projects/myspeed/'),
      );
      expect(findSiteContent(question, content, 'overview')).toMatchObject({
        status: 'answer',
        subjects: [{ label: 'MySpeed' }, { label: 'SpotifyTracker' }],
        sources: [
          {
            href: '/projects/myspeed/',
            excerpts: [
              facts.find(({ id }) => id === 'myspeed-fork')!.answer[locale],
            ],
          },
          {
            href: '/projects/spotify-stats-tracker/#upstream-import',
            excerpts: [
              facts.find(({ id }) => id === 'spotify-upstream-review')!.answer[
                locale
              ],
            ],
          },
        ],
      });
    },
  );

  it.each(approvedAnswers.filter((fixture) => fixture.id))(
    'uses the approved browser source for $question',
    (fixture) => {
      const locale = fixture.locale === 'de' ? 'de' : 'en';
      const fact = facts.find(({ id }) => id === fixture.id)!;
      const source = sourceLink(fact.sourceId, locale);
      const path = source.href.split('#')[0];
      const content: SiteContent = {
        locale,
        pages:
          path.startsWith('/downloads/') || path.startsWith('https://')
            ? []
            : [extractPage('<main><h1>Public portfolio</h1></main>', path)],
      };
      expect(
        findSiteContent(fixture.question, content, 'overview'),
      ).toMatchObject({
        status: fixture.status,
        lead: fact.answer[locale],
        sources: [{ href: source.href }],
      });
    },
  );

  it.each([
    'How did Timo use AI to code Tutto?',
    'Wie hat Timo KI beim Programmieren von Tutto eingesetzt?',
  ])('uses development evidence for %s', (question) => {
    const content = index();
    content.locale = question.startsWith('Wie') ? 'de' : 'en';
    content.pages.push(
      extractPage('<main><h1>Tutto</h1></main>', '/projects/tutto/'),
    );
    const result = findSiteContent(question, content, 'overview');
    expect(result?.status).toBe('answer');
    const passages = result?.sources.flatMap(({ excerpts }) => excerpts);
    expect(passages).toEqual([
      PROJECT_AI_NOTES.tutto?.development[content.locale],
    ]);
  });

  it.each(
    routing.map(
      (fixture) => approvedExpectation('routing', fixture) ?? fixture,
    ),
  )('uses only approved evidence in the browser for $question', (fixture) => {
    const locale = fixture.locale === 'de' ? 'de' : 'en';
    const content: SiteContent = { ...index(), locale };
    content.pages.push(
      extractPage(
        '<main><h1>Tutto</h1><p>Ask Otto evaluates game rules.</p></main>',
        '/projects/tutto/',
      ),
      extractPage(
        '<main><h1>About</h1><h2>Experience</h2><h3>Stadler internships</h3><p>C# and SQL plug-ins.</p></main>',
        '/about/',
      ),
    );
    const result =
      findSiteContent(fixture.question, content, 'overview') ??
      findSiteContent(fixture.question, content);
    if ('id' in fixture) {
      const fact = facts.find(({ id }) => id === fixture.id)!;
      expect(result).toMatchObject({
        status: fixture.status,
        lead: fact.answer[locale],
        sources: [{ href: sourceLink(fact.sourceId, locale).href }],
      });
    } else {
      expect(result?.status ?? 'unknown').toBe('unknown');
      expect(result?.sources.flatMap(({ excerpts }) => excerpts) ?? []).toEqual(
        [],
      );
    }
  });

  it.each([
    [
      'en',
      'What languages does he speak and what programming languages does he use?',
      'Languages',
      'German native',
      'English C1',
    ],
    [
      'de',
      'Welche Sprachen spricht Timo und welche Programmiersprachen nutzt er?',
      'Sprachen',
      'Deutsch Muttersprache',
      'Englisch C1',
    ],
  ] as const)(
    'combines spoken and programming language evidence in %s',
    (locale, question, heading, native, learned) => {
      const page = extractPage(
        `<main><h1>About</h1><h2>Skills</h2><h3>${heading}</h3><p>Java</p><p>C#</p><p>HTML & CSS</p><p>Where I used it</p><p>See example</p><h2>${heading}</h2><p>${native}</p><p>${learned}</p></main>`,
        '/about/',
      );
      const answer = findSiteContent(
        question,
        { locale, pages: [page] },
        'overview',
      );
      expect(answer?.status).toBe('answer');
      expect(answer?.lead).toContain(native);
      expect(answer?.lead).toContain(learned);
      expect(answer?.lead).toContain('Java');
      expect(answer?.lead).toContain('C#');
      expect(answer?.lead).not.toMatch(/HTML|See example/);
      expect(answer?.sources.map(({ href }) => href)).toEqual(['/about/']);
      expect(
        findSiteContent(
          question,
          {
            locale,
            pages: [
              {
                ...page,
                sections: page.sections.filter(
                  ({ heading }) => !heading.includes('›'),
                ),
              },
            ],
          },
          'overview',
        ),
      ).toMatchObject({
        status: 'partial',
        sources: [{ href: '/about/' }],
      });
    },
  );
  it.each([
    'AI?',
    'KI?',
    'usage of AI?',
    'How does Timo use AI?',
    'What AI tools does Timo use?',
    'Tell me about your use of AI',
    'Wofür nutzt Timo KI?',
  ])(
    'answers the broad AI-use question %s from the published Homelab and Hearthcoil pages',
    (question) => {
      expect(findSiteContent(question, index(), 'overview')).toMatchObject({
        status: 'answer',
        sources: [
          {
            href: '/homelab/',
            excerpts: [
              'Local language model inference at home.',
              'Chat interface for the local models.',
            ],
          },
          {
            href: '/projects/hearthcoil/',
            excerpts: [PROJECT_AI_NOTES.hearthcoil!.development.en],
          },
        ],
      });
    },
  );

  it('does not use the broad AI overview to answer unsupported details', () => {
    expect(
      findSiteContent('Which AI model powers Tutto?', index(), 'overview'),
    ).toBeNull();
    expect(
      findSiteContent(
        'Which AI provider does Timo use at Abacus?',
        index(),
        'overview',
      ),
    ).toBeNull();
  });

  it('keeps polite requests tied to a named project and ignores number-only search terms', () => {
    expect(
      findSiteContent(
        'Can you help me understand Hearthcoil?',
        index(),
        'overview',
      ),
    ).toMatchObject({ sources: [{ href: '/projects/hearthcoil/' }] });
    expect(
      findSiteContent(
        'Kannst du mir bei Hearthcoil helfen?',
        index(),
        'overview',
      ),
    ).toMatchObject({ sources: [{ href: '/projects/hearthcoil/' }] });
    const content = index();
    content.pages[0].sections[0].paragraphs.push('Network 2.5 GbE');
    expect(findSiteContent('What is 2+2?', content)).toBeNull();
  });

  it('answers exact stack and Abacus role paraphrases from the offline index', () => {
    const content = index();
    content.pages.push(
      extractPage(
        '<main><h1>About</h1><h2>Experience</h2><h3>Software Engineer · Abacus</h3><p>Java and Vaadin document workflows.</p></main>',
        '/about/',
      ),
    );
    expect(
      findSiteContent('What stack powers SpotifyTracker?', content, 'overview'),
    ).toMatchObject({
      lead: expect.stringContaining('written in Python'),
    });
    expect(
      findSiteContent(
        'Welche Datenbank nutzt SpotifyTracker?',
        { ...content, locale: 'de' },
        'overview',
      ),
    ).toMatchObject({
      lead: expect.stringMatching(/^SpotifyTracker speichert.*SQLite/),
    });
    const typo = resolveSiteNames('Spofity tracker tech stack?', content);
    expect(findSiteContent(typo.question, content, 'overview')).toMatchObject({
      lead: expect.stringContaining('written in Python'),
    });
    for (const [locale, question] of [
      ['en', 'What does Timo do at Abacus?'],
      ['de', 'Was macht Timo bei Abacus?'],
    ] as const) {
      expect(
        findSiteContent(question, { ...content, locale }, 'overview'),
      ).toMatchObject({
        lead: expect.stringMatching(/Java.*Vaadin/),
        sources: [{ href: '/about/#abacus' }],
      });
    }
  });

  it('does not use a reviewed project lead when the supporting public text was withdrawn', () => {
    const href = '/projects/hearthcoil/';
    const page = extractPage(
      '<main><h1>Hearthcoil</h1><p>The project is archived.</p></main>',
      href,
    );
    const answer = findSiteContent(
      'What is Hearthcoil?',
      { locale: 'en', pages: [page] },
      'overview',
    );
    expect(answer?.lead).toBeUndefined();
    expect(answer?.sources[0].excerpts).toEqual(['The project is archived.']);
  });

  it('distinguishes Timo’s profile and spoken languages from project technology', () => {
    const content = index();
    content.pages.push(
      extractPage(
        '<main><h1>About</h1><p>I’m a software engineer based in Switzerland.</p><h2>Skills</h2><h3>Languages</h3><p>Java</p><h2>Languages</h2><p>German native</p><p>English C1</p></main>',
        '/about/',
      ),
    );
    expect(
      findSiteContent('Tell me about Timo', content, 'overview'),
    ).toMatchObject({
      sources: [
        {
          href: '/about/',
          excerpts: ['I’m a software engineer based in Switzerland.'],
        },
      ],
    });
    expect(
      findSiteContent('What languages does he speak?', content, 'overview'),
    ).toMatchObject({
      lead: facts.find(({ id }) => id === 'portfolio-spoken-languages')!.answer
        .en,
      sources: [{ href: '/about/' }],
    });
  });

  it.each([
    ['en', 'the strategy coach'],
    ['de', 'der Strategiecoach'],
  ] as const)(
    'resolves the %s coach follow-up on Tutto',
    (locale, question) => {
      const href = '/projects/tutto/';
      const pages = [extractPage('<main><h1>Tutto</h1></main>', href)];
      expect(
        findSiteContent(question, { locale, pages }, 'related', {
          href,
          label: 'Tutto',
        }),
      ).toMatchObject({
        status: 'answer',
        sources: [{ href, excerpts: [expect.stringContaining('Ask Otto')] }],
      });
    },
  );

  it('answers direct questions about self-hosting and keeps the answer scoped', () => {
    expect(
      findSiteContent('Does Timo self-host?', index(), 'overview'),
    ).toMatchObject({
      note: 'Timo hosts this portfolio on his homelab and uses it to deploy and monitor his applications.',
      sources: [
        {
          href: '/homelab/',
          excerpts: [],
        },
      ],
    });
    expect(
      findSiteContent('Hostet Timo seine Website selbst?', index(), 'overview')
        ?.sources[0].href,
    ).toBe('/homelab/');
    expect(
      findSiteContent('How do I access his home server?', index(), 'overview'),
    ).toBeNull();
    expect(
      findSiteContent(
        'Where is his home server, and how do I access it?',
        index(),
      ),
    ).toBeNull();
  });

  it('keeps local-only pet records private alongside the approved public count', () => {
    const published = index();
    const content = {
      ...published,
      localPets: {
        overview: {
          en: 'The test account has three cats.',
          de: 'Das Testkonto hat drei Katzen.',
        },
        cats: [
          {
            name: 'Widget',
            description: {
              en: 'Widget has black fur.',
              de: 'Widget hat schwarzes Fell.',
            },
          },
          {
            name: 'Pixel',
            description: {
              en: 'Pixel has a striped coat.',
              de: 'Pixel hat gestreiftes Fell.',
            },
          },
          {
            name: 'Kernel',
            description: {
              en: 'Kernel has dark spots.',
              de: 'Kernel hat dunkle Flecken.',
            },
            unverifiedVariety: true as const,
          },
        ],
      },
    };
    expect(
      findSiteContent('Does Timo have pets?', published, 'overview'),
    ).toMatchObject({
      lead: 'Timo has three cats.',
      sources: [{ href: '/ask-pets.txt' }],
    });
    expect(parseSiteContent(content, 'en')).toEqual(published);
    expect(
      findSiteContent('Tell me about Widget', published, 'overview'),
    ).toBeNull();
    expect(namesSiteSubject('Tell me about Widget', content)).toBe(true);
    expect(
      findSiteContent('Tell me about Widget', content, 'overview'),
    ).toMatchObject({
      status: 'answer',
      note: 'Widget has black fur.',
      sources: [],
      localOnly: true,
    });
    expect(
      findSiteContent(
        'Was weisst du über Pixel?',
        { ...content, locale: 'de' },
        'overview',
      ),
    ).toMatchObject({
      note: 'Pixel hat gestreiftes Fell.',
      localOnly: true,
    });
    expect(
      findSiteContent('What exact coat variety is Kernel?', content, 'overview')
        ?.note,
    ).toMatch(/dark spots.+unverified/i);
    expect(
      findSiteContent('Are there photos of Widget?', content, 'overview'),
    ).toMatchObject({
      status: 'unknown',
      sources: [],
    });
    expect(
      findSiteContent('Tell me about Timo’s Java work', content, 'overview'),
    ).toBeNull();
  });

  it('distinguishes Hearthcoil reference footage from motion capture', () => {
    const footage =
      'I performed attack movements myself and filmed them from two angles as animation reference.';
    const content: SiteContent = {
      locale: 'en',
      pages: [
        extractPage(
          `<main><h1>Hearthcoil</h1><h2>What I built</h2><p>I have worked on combat. ${footage}</p></main>`,
          '/projects/hearthcoil/',
        ),
      ],
    };
    expect(
      findSiteContent(
        'Did he motion-capture the attacks?',
        content,
        'overview',
      ),
    ).toMatchObject({
      status: 'partial',
      note: 'I don’t have public confirmation of motion capture.',
      sources: [{ href: '/projects/hearthcoil/', excerpts: [footage] }],
    });
  });

  it.each([
    [
      'en',
      'Does Hearthcoil use an LLM for gameplay?',
      /gameplay runs without language models/,
    ],
    ['de', 'Nutzt Hearthcoil KI im Spiel?', /im Spiel keine Sprachmodelle/],
  ] as const)(
    'cites Hearthcoil gameplay details in %s',
    (locale, question, excerpt) => {
      const content: SiteContent = {
        locale,
        pages: [
          extractPage(
            '<main><h1>Hearthcoil</h1></main>',
            '/projects/hearthcoil/',
          ),
        ],
      };
      expect(findSiteContent(question, content, 'overview')).toMatchObject({
        status: 'answer',
        sources: [
          {
            href: '/projects/hearthcoil/',
            excerpts: [expect.stringMatching(excerpt)],
          },
        ],
      });
    },
  );

  it('distinguishes development assistance from product behavior and refuses invented percentages', () => {
    const index: SiteContent = {
      locale: 'en',
      pages: [
        extractPage('<main><h1>Tutto</h1></main>', '/projects/tutto/'),
        extractPage(
          '<main><h1>Carini Management System</h1></main>',
          '/projects/carini-management-system/',
        ),
        extractPage(
          '<main><h1>Bachelor thesis</h1></main>',
          '/projects/bachelor-thesis/',
        ),
      ],
    };
    expect(parseSiteContent(index, 'en')).toEqual(index);
    expect(
      findSiteContent('Was AI used to develop Tutto?', index, 'overview'),
    ).toMatchObject({
      status: 'answer',
      sources: expect.arrayContaining([
        {
          href: '/projects/tutto/',
          title: 'Tutto',
          excerpts: [PROJECT_AI_NOTES.tutto!.development.en],
        },
        ...PROJECT_AI_NOTES.tutto!.commits!.map(({ href, label }) => ({
          href,
          title: label.en,
          excerpts: [],
        })),
      ]),
    });
    expect(
      findSiteContent('Is Ask Otto an LLM?', index, 'overview'),
    ).toMatchObject({
      status: 'answer',
      lead: facts.find(({ id }) => id === 'tutto-coach')!.answer.en,
      sources: [{ href: '/projects/tutto/' }],
    });
    expect(
      findSiteContent('Did Timo use AI on CARINI?', index, 'overview'),
    ).toMatchObject({
      status: 'unknown',
      sources: [],
      note: PROJECT_AI_NOTES['carini-management-system']!.development.en,
    });
    expect(
      findSiteContent(
        'Was AI used for the bachelor thesis?',
        index,
        'overview',
      ),
    ).toMatchObject({
      status: 'unknown',
      sources: [],
      note: PROJECT_AI_NOTES['bachelor-thesis']!.development.en,
    });
    expect(
      findSiteContent('Did he use AI on older projects?', index, 'overview'),
    ).toMatchObject({
      status: 'unknown',
      sources: [],
    });
    expect(
      findSiteContent(
        'What percentage did AI write in Tutto?',
        index,
        'overview',
      ),
    ).toMatchObject({
      status: 'unknown',
      note: 'I don’t have a verified percentage for how much AI wrote.',
    });
    expect(
      findSiteContent(
        'What percentage of games does Ask Otto win?',
        index,
        'overview',
      ),
    ).toBeNull();
  });

  it('answers a direct German question about AI use for the thesis', () => {
    const content: SiteContent = {
      locale: 'de',
      pages: [
        extractPage(
          '<main><h1>Bachelorarbeit</h1></main>',
          '/projects/bachelor-thesis/',
        ),
      ],
    };
    expect(
      findSiteContent(
        'Wurde KI für die Bachelorarbeit eingesetzt?',
        content,
        'overview',
      ),
    ).toMatchObject({
      status: 'unknown',
      sources: [],
      note: PROJECT_AI_NOTES['bachelor-thesis']!.development.de,
    });
  });

  it('extracts main page text, including closed sections and hardware rows', () => {
    const result = JSON.stringify(extractPage(homelab, '/homelab/'));
    expect(result).toContain('Memory 32 GB DDR5');
    expect(result).toContain('Dashboards show temperatures & traffic.');
    expect(result).toContain('Grafana');
    expect(result).not.toMatch(
      /Navigation text|Ask example|Hidden status|ignoredScript|Footer text|Current status/,
    );
  });

  it('writes a fresh locale index from all built page routes', async () => {
    const output = await mkdtemp(join(tmpdir(), 'ask-content-'));
    try {
      await mkdir(join(output, 'homelab'));
      await writeFile(join(output, 'homelab/index.html'), homelab);
      await writeFile(
        join(output, 'index.html'),
        '<main><h1>Home</h1><p>Portfolio.</p></main>',
      );
      await writeFile(
        join(output, '404.html'),
        '<main><h1>Not found</h1></main>',
      );
      const dir = pathToFileURL(output + '/');
      await writeSiteContent(dir, 'en');
      const bundle = JSON.parse(
        await readFile(join(output, 'ask-facts.json'), 'utf8'),
      );
      expect(bundle).toMatchObject({
        schemaVersion: 1,
        corpusVersion,
        facts: expect.arrayContaining([
          expect.objectContaining({
            id: 'spotify-python',
            topic: 'stack',
            aliases: expect.arrayContaining(['python', 'technologien']),
            answers: {
              en: expect.stringContaining('Flask'),
              'de-CH': expect.stringContaining('Flask'),
            },
            sourceId: 'spotify-code',
          }),
        ]),
      });
      const artifact = join(output, SITE_CONTENT_PATH.slice(1));
      const { pages } = JSON.parse(await readFile(artifact, 'utf8'));
      expect(pages.map(({ href }: { href: string }) => href)).toEqual([
        '/',
        '/homelab/',
      ]);
      const input = join(output, 'homelab/index.html');
      await writeFile(input, homelab.replace('32 GB', '48 GB'));
      await writeSiteContent(dir, 'en');
      const changed = await readFile(artifact, 'utf8');
      expect(changed).toContain('48 GB');
      expect(changed).not.toContain('32 GB');
    } finally {
      await rm(output, { recursive: true, force: true });
    }
  });

  it('answers the Homelab overview from the page and links back to it', () => {
    expect(
      findSiteContent('Tell me about the homelab?', index(), 'overview'),
    ).toMatchObject({
      status: 'answer',
      sources: [
        {
          href: '/homelab/',
          excerpts: ['I self-host this website on a server I built.'],
        },
      ],
    });
    expect(
      findSiteContent('Wie sieht dein Homelab aus?', index(), 'overview')
        ?.sources[0].href,
    ).toBe('/homelab/');
    expect(
      findSiteContent('Erzähl mir vom Homelab', index(), 'overview')?.sources[0]
        .excerpts,
    ).toEqual(['I self-host this website on a server I built.']);
    expect(
      findSiteContent('What CPU is in the homelab?', index(), 'overview'),
    ).toBeNull();
  });

  it('ranks specific current text and still links to a recognized page when a detail is absent', () => {
    expect(
      findSiteContent('How much RAM does the workstation have?', index())
        ?.sources[0].excerpts[0],
    ).toContain('32 GB DDR5');
    expect(
      findSiteContent('How do you monitor temperatures?', index())?.sources[0]
        .excerpts[0],
    ).toContain('temperatures & traffic');
    expect(
      findSiteContent('What does Grafana monitor?', index())?.sources[0]
        .excerpts[0],
    ).toContain('temperatures & traffic');
    expect(
      findSiteContent('Which GPU does the workstation use?', index())
        ?.sources[0].excerpts[0],
    ).toContain('RTX 5090');
    expect(
      findSiteContent('Welche Grafikkarte hat der Entwicklungsserver?', index())
        ?.sources[0].excerpts[0],
    ).toBe('GPU AMD Radeon');
    expect(
      findSiteContent('What does the workstation do?', index())?.sources[0]
        .excerpts[0],
    ).toContain('Daily driver');
    expect(
      findSiteContent('Who supplied the homelab modem?', index()),
    ).toMatchObject({
      status: 'unknown',
      sources: [{ href: '/homelab/', excerpts: [] }],
    });
    expect(findSiteContent('Who won the World Cup?', index())).toBeNull();
    expect(
      findSiteContent('What is the password for the homelab?', index()),
    ).toBeNull();
  });

  it('uses complementary pages and suppresses duplicated excerpts', () => {
    const result = findSiteContent(
      'How is the website built and hosted?',
      index(),
    );
    expect(result).toMatchObject({
      status: 'answer',
      missing: [],
      sources: [
        {
          href: '/projects/this-website/',
          excerpts: ['GitHub Actions builds a Docker image for this website.'],
        },
        {
          href: '/homelab/',
          excerpts: ['I self-host this website on a server I built.'],
        },
      ],
    });
  });

  it('keeps a precise answer short and names the missing part of a compound question', () => {
    expect(
      findSiteContent('Which GPU does the workstation use?', index()),
    ).toMatchObject({
      status: 'answer',
      sources: [{ href: '/homelab/', excerpts: ['GPU NVIDIA RTX 5090'] }],
    });
    expect(
      findSiteContent(
        'Which GPU does the workstation use and how much did it cost?',
        index(),
      ),
    ).toMatchObject({
      status: 'partial',
      sources: [{ href: '/homelab/', excerpts: ['GPU NVIDIA RTX 5090'] }],
      missing: ['how much did it cost?'],
    });
  });

  it.each([
    [
      'en',
      'Tell me how this website is hosted. Tell me who won the World Cup.',
      'How is this website hosted? Which project used Flask?',
    ],
    [
      'de',
      'Erklär mir, wie diese Website gehostet wird. Sag mir, wer die Fussball-WM gewonnen hat.',
      'Wie wird diese Website gehostet? Welches Projekt nutzte Flask?',
    ],
  ] as const)(
    'preserves per-clause coverage on the %s browser fallback',
    async (locale, mixed, supported) => {
      const content = { ...index(), locale };
      const first = findSiteContent(mixed, content, 'overview');
      expect(first).toMatchObject({
        status: 'partial',
        note: expect.stringMatching(
          locale === 'de' ? /bleibt offen/ : /still unanswered/,
        ),
        sources: [{ href: '/projects/this-website/' }],
      });
      expect(findSiteContent(supported, content, 'overview')).toMatchObject({
        status: 'answer',
        preferModel: true,
        missing: [],
        sources: [
          { href: '/projects/this-website/' },
          { href: '/projects/spotify-stats-tracker/#contribution' },
        ],
      });
      const window = new Window();
      try {
        vi.stubGlobal('document', window.document);
        window.document.documentElement.lang = locale;
        const lookup = vi.fn<typeof fetch>(async (path) =>
          path === `/ask-content-${locale}.json`
            ? Response.json(content)
            : new Response(null, { status: 503 }),
        );
        vi.stubGlobal('fetch', lookup);
        window.document.body.innerHTML =
          '<section data-mode="local" data-version="fixture"><div data-ask-result></div><form><textarea></textarea><button type="submit">Ask</button></form></section>';
        const panel = window.document.querySelector('section')!;
        panel.dataset.messages = JSON.stringify({ wait: 'Looking…' });
        setupAskWork(panel as unknown as HTMLElement);
        for (const question of [mixed, supported]) {
          panel.querySelector('textarea')!.value = question;
          panel
            .querySelector('form')!
            .dispatchEvent(new window.Event('submit'));
          await vi.waitFor(() =>
            expect(panel.querySelector('button')?.disabled).toBe(false),
          );
        }
        const [partial, full] = panel.querySelectorAll('[data-ask-reply]');
        expect(partial.textContent).toMatch(
          locale === 'de' ? /bleibt offen/ : /still unanswered/,
        );
        expect(partial.querySelectorAll('a')).toHaveLength(1);
        expect(
          Array.from(full.querySelectorAll('a'), (link) =>
            link.getAttribute('href'),
          ),
        ).toEqual([
          '/projects/this-website/',
          '/projects/spotify-stats-tracker/#contribution',
        ]);
        expect(
          lookup.mock.calls.filter(([path]) => path === '/api/ask'),
        ).toHaveLength(1);
      } finally {
        vi.unstubAllGlobals();
        window.close();
      }
    },
  );

  it('keeps an unnamed follow-up with the project it refers to', () => {
    expect(
      findSiteContent(
        'What does SpotifyTracker do, and what is it built with?',
        index(),
      ),
    ).toMatchObject({
      status: 'answer',
      sources: [
        {
          href: '/projects/spotify-stats-tracker/',
          excerpts: [
            'Self-hosted Spotify history for multiple users.',
            'I rewrote the tracker using Python, Flask and SQLite.',
          ],
        },
      ],
      missing: [],
    });
  });

  it('keeps website hosting scoped when a follow-up changes subject', () => {
    expect(
      findSiteContent(
        'What is the website built with and what is SpotifyTracker and where is it hosted?',
        index(),
      ),
    ).toMatchObject({
      status: 'partial',
      sources: [
        { href: '/projects/this-website/' },
        { href: '/projects/spotify-stats-tracker/' },
      ],
      missing: ['where is it hosted?'],
    });
  });

  it('uses the website case study when it is the source that states the location', () => {
    const content = index();
    content.pages.find(
      ({ href }) => href === '/homelab/',
    )!.sections[0].paragraphs = [
      'Always on: hosts this site and every service.',
    ];
    content.pages
      .find(({ href }) => href === '/projects/this-website/')!
      .sections[0].paragraphs.push('This site is served from the living room.');
    expect(
      findSiteContent(
        'What is the website built with and where is it hosted?',
        content,
      ),
    ).toMatchObject({
      status: 'answer',
      sources: [
        {
          href: '/projects/this-website/',
          excerpts: [
            'GitHub Actions builds a Docker image for this website.',
            'This site is served from the living room.',
          ],
        },
      ],
    });
  });

  it('keeps a hardware follow-up on the same machine and leaves unknown dates open', () => {
    expect(
      findSiteContent(
        'Which GPU does the workstation use and which CPU does it use?',
        index(),
      ),
    ).toMatchObject({
      status: 'answer',
      sources: [
        {
          href: '/homelab/',
          excerpts: ['GPU NVIDIA RTX 5090', 'CPU Intel i7-13700K'],
        },
      ],
    });
    expect(
      findSiteContent('What is SpotifyTracker and when was it built?', index()),
    ).toMatchObject({
      status: 'partial',
      missing: ['when was it built?'],
    });
    expect(
      findSiteContent('What is SpotifyTracker and who hosts it?', index()),
    ).toMatchObject({
      status: 'partial',
      missing: ['who hosts it?'],
    });
  });

  it('associates dates with the matching real timeline entry', async () => {
    const container = await AstroContainer.create();
    const degree = await container.renderToString(TimelineItem, {
      props: { period: '2016–2018', title: 'BSc', org: 'FH Vorarlberg' },
    });
    const school = await container.renderToString(TimelineItem, {
      props: {
        period: '2010–2015',
        title: 'Matura',
        org: 'HTL Dornbirn',
        collapsed: true,
      },
    });
    const page = extractPage(
      '<main><h1>About</h1><h2>Education</h2><ol>' +
        degree +
        school +
        '</ol></main>',
      '/about/',
    );
    expect(
      findSiteContent('When was the BSc at FH Vorarlberg?', {
        locale: 'en',
        pages: [page],
      }),
    ).toMatchObject({
      status: 'answer',
      sources: [{ href: '/about/', excerpts: ['2016–2018'] }],
    });
    expect(
      findSiteContent('When was the Matura at HTL Dornbirn?', {
        locale: 'en',
        pages: [page],
      }),
    ).toMatchObject({
      status: 'answer',
      sources: [{ href: '/about/', excerpts: ['2010–2015'] }],
    });
  });

  it('keeps comparisons with an unsupported qualifier as a source hint', () => {
    expect(
      findSiteContent(
        'Compare the price of SpotifyTracker and the website?',
        index(),
      ),
    ).toMatchObject({
      status: 'unknown',
      sources: [{ excerpts: [] }, { excerpts: [] }],
    });
  });

  it('rejects wrong-language or external-link content', () => {
    expect(parseSiteContent({ ...index(), locale: 'de' }, 'en')).toBeNull();
    expect(
      parseSiteContent(
        {
          locale: 'en',
          pages: [{ ...index().pages[0], href: '//example.test/' }],
        },
        'en',
      ),
    ).toBeNull();
  });

  it('corrects small, unambiguous spelling errors in project names', () => {
    expect(resolveSiteNames('Tell me about heathcoul?', index())).toEqual({
      question: 'Tell me about Hearthcoil?',
      alternatives: [],
    });
    const content = index();
    content.pages.push(
      extractPage(
        '<main><h1>Tutto</h1><p>A dice game.</p></main>',
        '/projects/tutto/',
      ),
    );
    expect(resolveSiteNames('Tell me about Tutot?', content)).toEqual({
      question: 'Tell me about Tutto?',
      alternatives: [],
    });
    expect(
      resolveSiteNames('How did the project start?', index()).question,
    ).toBe('How did the project start?');
    expect(
      resolveSiteNames('What is the heathcoul password?', index()).question,
    ).toBe('What is the heathcoul password?');
    const ambiguous = {
      locale: 'en' as const,
      pages: [
        extractPage(
          '<main><h1>Barden</h1><p>One.</p></main>',
          '/projects/barden/',
        ),
        extractPage(
          '<main><h1>Bardon</h1><p>Another.</p></main>',
          '/projects/bardon/',
        ),
      ],
    };
    expect(resolveSiteNames('What is Bardin?', ambiguous)).toEqual({
      question: 'What is Bardin?',
      alternatives: ['Barden', 'Bardon'],
    });
    expect(
      resolveSiteNames('Where is Bardin hosted?', ambiguous, 'Barden').question,
    ).toBe('Where is Barden hosted?');
  });

  it.each([
    ["how many 'r's in strawberry?", 'en', '“strawberry” has 3 r’s.'],
    ['How many "a"s in Apple?', 'en', '“Apple” has 1 a.'],
    ['How many y in apple?', 'en', '“apple” has 0 y’s.'],
    [
      "Wie viele 'e' sind in Erdbeere?",
      'de',
      'In „Erdbeere“ kommt „e“ 4-mal vor.',
    ],
  ] as const)('literally counts letters in %s', (question, locale, answer) => {
    expect(socialReply(question, locale)).toBe(answer);
  });

  it('varies unsourced replies and keeps a greeting plus a question available for lookup', () => {
    expect(socialReply('thanks!', 'en')).toBe('You’re welcome!');
    expect(socialReply('Was geht?', 'de')).toMatch(/Nicht viel/);
    expect(socialReply('yo, what is Hearthcoil?', 'en')).toBeNull();
    expect(unknownReply('en', 0)).not.toBe(unknownReply('en', 1));
  });

  it('keeps education and pet follow-ups grounded when inference is offline', async () => {
    const window = new Window();
    try {
      vi.stubGlobal('document', window.document);
      const content = index();
      content.pages.push(
        extractPage('<main><h1>About</h1><p>Education</p></main>', '/about/'),
        extractPage(
          '<main><h1>Bachelor thesis</h1><p>Monte Carlo simulation.</p></main>',
          '/projects/bachelor-thesis/',
        ),
      );
      const fetchLocal = vi.fn<typeof fetch>(async (path) =>
        path === '/ask-content-en.json'
          ? Response.json(content)
          : new Response(null, { status: 503 }),
      );
      vi.stubGlobal('fetch', fetchLocal);
      window.document.documentElement.lang = 'en';
      window.document.body.innerHTML =
        '<section data-mode="local" data-version="fixture" data-messages="{}"><div data-ask-result></div><form><textarea></textarea><button type="submit">Ask</button></form></section>';
      const panel = window.document.querySelector('section')!;
      setupAskWork(panel as unknown as HTMLElement);
      const ask = async (question: string, answer: RegExp) => {
        panel.querySelector('textarea')!.value = question;
        panel.querySelector('form')!.dispatchEvent(new window.Event('submit'));
        await vi.waitFor(() => {
          expect(panel.querySelector('button')?.disabled).toBe(false);
          expect(
            panel.querySelector('[data-ask-reply]:last-child')?.textContent,
          ).toMatch(answer);
        });
        return panel.querySelector('[data-ask-reply]:last-child')!;
      };
      const education = await ask('education', /BSc.*Matura/is);
      expect(education.textContent).not.toMatch(/master/i);
      await ask('more', /thesis.*class/is);
      await ask('pets', /three cats/i);
      const pets = await ask('what kind', /Rudi.*Georgi.*Benji/s);
      expect(pets.querySelector('a[href$=".txt"]')).toBeNull();
      await ask('all negatives about him', /period in his CV/i);
      expect(fetchLocal.mock.calls.some(([path]) => path === '/api/ask')).toBe(
        true,
      );
    } finally {
      vi.unstubAllGlobals();
      window.close();
    }
  });

  it('keeps a profile conversation in scope and lists all work and projects when inference is offline', async () => {
    const window = new Window();
    try {
      vi.stubGlobal('document', window.document);
      window.document.documentElement.lang = 'en';
      const content = parseSiteContent(
        {
          locale: 'en',
          pages: [
            extractPage(
              '<main><h1>About</h1><p data-ask-overview>Timo works as a software engineer at Abacus and previously worked at Stadler. His professional work includes Java document workflows, VPN setup, and C# and SQL plugins.</p></main>',
              '/about/',
            ),
            extractPage(
              '<main><h1>Projects</h1><p data-ask-overview>Timo’s public projects include SpotifyTracker, MySpeed, Tutto, Hearthcoil, his bachelor thesis, CARINI, and this portfolio website.</p></main>',
              '/projects/',
            ),
            extractPage(
              '<main><h1>Hearthcoil</h1><p>A couch co-op game in Unity.</p></main>',
              '/projects/hearthcoil/',
            ),
          ],
        },
        'en',
      )!;
      const requests: { question: string; history?: unknown[] }[] = [];
      const lookup = vi.fn<typeof fetch>(async (path, options) => {
        if (path === '/ask-content-en.json') return Response.json(content);
        if (path === '/api/ask') {
          requests.push(JSON.parse(String(options?.body)));
          return new Response(null, { status: 503 });
        }
        return new Response(null, { status: 404 });
      });
      vi.stubGlobal('fetch', lookup);
      window.document.body.innerHTML =
        '<section data-mode="local" data-version="fixture"><div data-ask-result></div><form><textarea></textarea><button type="submit">Ask</button></form></section>';
      const panel = window.document.querySelector('section')!;
      panel.dataset.messages = JSON.stringify({
        wait: 'Thinking…',
        related: 'Related detail',
        seePage: 'See the page for more.',
      });
      setupAskWork(panel as unknown as HTMLElement);
      const replies = () =>
        Array.from(panel.querySelectorAll('[data-ask-reply]'));
      for (const [index, question] of [
        'short pitch about timo',
        'any more details?',
        'more about his work',
        'nice summary of work and projects',
        'summary of his CV',
        'longer summary please',
      ].entries()) {
        panel.querySelector('textarea')!.value = question;
        panel.querySelector('form')!.dispatchEvent(new window.Event('submit'));
        await vi.waitFor(() => expect(replies()).toHaveLength(index + 1));
        await vi.waitFor(() =>
          expect(panel.querySelector('button')?.disabled).toBe(false),
        );
      }

      expect(requests).toEqual([
        expect.objectContaining({ question: 'short pitch about timo' }),
        expect.objectContaining({
          question: 'portfolio highlights',
          history: [
            expect.objectContaining({
              question: 'short pitch about timo',
              answer: expect.stringContaining('Abacus'),
            }),
          ],
        }),
        expect.objectContaining({
          question: 'nice summary of work and projects',
        }),
        expect.objectContaining({ question: 'summary of his CV' }),
        expect.objectContaining({ question: 'longer summary of his cv' }),
      ]);
      const [pitch, highlight, work, inventory, cv, expandedCv] = replies();
      expect(pitch.textContent).toMatch(/Abacus.*Stadler/s);
      expect(highlight.textContent).toMatch(/Hearthcoil.*launcher/is);
      expect(work.textContent).toMatch(/Abacus.*Stadler/s);
      expect(cv.textContent).toContain('HTL Dornbirn');
      expect(expandedCv.textContent).toContain('HTL Dornbirn');
      expect(expandedCv.textContent).toContain('Java/Vaadin');
      expect(expandedCv.textContent).toContain('VPN certificates');
      expect(expandedCv.querySelector('a[href="/about/"]')).not.toBeNull();
      for (const project of [
        'SpotifyTracker',
        'Tutto',
        'timo.rzipas.win',
        'MySpeed',
        'Bachelor thesis',
        'Carini · SharePoint',
        'Hearthcoil',
      ])
        expect(inventory.textContent).toContain(project);
      expect(
        inventory.querySelectorAll('a[href="/about/"], a[href="/projects/"]')
          .length,
      ).toBe(2);
    } finally {
      vi.unstubAllGlobals();
      window.close();
    }
  });

  it('keeps the “yo” work conversation on reviewed career evidence when the API is offline', async () => {
    const window = new Window();
    try {
      vi.stubGlobal('document', window.document);
      window.document.documentElement.lang = 'en';
      const content = parseSiteContent(
        {
          locale: 'en',
          pages: [
            extractPage(
              '<main><h1>About</h1><p data-ask-overview>Timo works as a software engineer at Abacus and previously worked at Stadler RDS. His professional work includes Java document workflows, VPN certificate management and C# and SQL tools. Current update: Outside work I am refining Hearthcoil and improving my portfolio chatbot.</p><h2>Experience</h2><h3>Software Engineer · Abacus</h3><p>Timo improved the receivables and payables document workflow and wrote automated tests for it.</p><h3>Software Developer · Stadler RDS</h3><p>Timo built an Angular frontend to manage VPN certificates used for communication between trains and Rail Data Services.</p><h3>Stadler internships</h3><p>Timo built C# and SQL plug-ins for Outlook and MindManager to share project data and make assigned tasks accessible.</p></main>',
              '/about/',
            ),
            extractPage(
              '<main><h1>CARINI</h1><p>Timo built a SharePoint document-management system.</p></main>',
              '/projects/carini-management-system/',
            ),
          ],
        },
        'en',
      )!;
      const lookup = vi.fn<typeof fetch>(async (path) =>
        path === '/ask-content-en.json'
          ? Response.json(content)
          : new Response(null, { status: 503 }),
      );
      vi.stubGlobal('fetch', lookup);
      window.document.body.innerHTML =
        '<section data-mode="local" data-version="fixture"><div data-ask-result></div><form><textarea></textarea><button type="submit">Ask</button></form></section>';
      const panel = window.document.querySelector('section')!;
      panel.dataset.messages = JSON.stringify({ wait: 'Looking…' });
      setupAskWork(panel as unknown as HTMLElement);
      const replies = () =>
        Array.from(panel.querySelectorAll('[data-ask-reply]'));
      for (const [index, question] of [
        'yo',
        'work',
        'more?',
        'more about work',
        'thats the same again tell me more',
      ].entries()) {
        panel.querySelector('textarea')!.value = question;
        panel.querySelector('form')!.dispatchEvent(new window.Event('submit'));
        await vi.waitFor(() => expect(replies()).toHaveLength(index + 1));
        await vi.waitFor(() =>
          expect(panel.querySelector('button')?.disabled).toBe(false),
        );
      }

      const [greeting, overview, otherRoles, abacus, carini] = replies();
      expect(greeting.textContent).toMatch(/Hey|Hi/i);
      expect(overview.textContent).toMatch(/Abacus.*Stadler.*Outlook/is);
      expect(overview.querySelector('a')?.getAttribute('href')).toBe(
        '/about/#abacus',
      );
      expect(otherRoles.textContent).toMatch(
        /Code Base Camp.*CARINI.*2011 and 2013/is,
      );
      expect(abacus.textContent).toMatch(/automated tests.*Jenkins/is);
      expect(carini.textContent).toMatch(/CARINI.*SharePoint/is);
      expect(
        replies()
          .map(({ textContent }) => textContent)
          .join(' '),
      ).not.toMatch(/Outside work|portfolio chatbot/i);
      expect(
        lookup.mock.calls
          .filter(([path]) => path === '/api/ask')
          .map(([, options]) => JSON.parse(String(options?.body)).question),
      ).toEqual([
        'work',
        'more?',
        'more about work',
        'thats the same again tell me more',
      ]);
    } finally {
      vi.unstubAllGlobals();
      window.close();
    }
  });

  it.each([
    ['ah yes thats what i meant thanks', 'en', 'You’re welcome!'],
    [
      'Oh yeah, that’s exactly what I meant, thank you!',
      'en',
      'You’re welcome!',
    ],
    ['Ah ja, genau das meinte ich, danke!', 'de', 'Gern!'],
    ['Thanks, which GPU does the workstation use?', 'en', null],
  ] as const)('responds appropriately to %s', (question, locale, reply) => {
    expect(socialReply(question, locale)).toBe(reply);
  });

  it('answers a casual greeting, remembers the workstation for a follow-up, and starts fresh on reset', async () => {
    const window = new Window();
    try {
      vi.stubGlobal('document', window.document);
      const content = index();
      content.pages.push(
        extractPage(
          '<main><h1>About</h1><h2>Skills</h2><h3>Languages</h3><p>Java</p></main>',
          '/about/',
        ),
        extractPage(
          '<main><h1>Projects</h1><p>This site is offered in two languages.</p></main>',
          '/projects/',
        ),
      );
      const fakeFetch = vi.fn<typeof fetch>(async (path) =>
        path === '/ask-content-en.json'
          ? Response.json(content)
          : new Response(null, { status: 503 }),
      );
      vi.stubGlobal('fetch', fakeFetch);
      window.document.documentElement.lang = 'en';
      window.document.body.innerHTML =
        '<section data-mode="local" data-version="fixture"><div data-ask-result></div><form><textarea></textarea><button type="submit">Send</button><button type="button" data-ask-reset>New chat</button></form></section>';
      const panel = window.document.querySelector('section')!;
      panel.dataset.messages = JSON.stringify({
        source: 'From the site',
        related: 'Related',
        wait: 'Thinking',
      });
      setupAskWork(panel as unknown as HTMLElement);
      const ask = async (question: string, answer: string) => {
        panel.querySelector('textarea')!.value = question;
        panel.querySelector('form')!.dispatchEvent(new window.Event('submit'));
        await vi.waitFor(() =>
          expect(
            panel.querySelector('[data-ask-reply]:last-child')?.textContent,
          ).toContain(answer),
        );
      };
      await ask(
        'yo what up?',
        'What do you wanna know about Timo or his work?',
      );
      await ask("how many 'r's in strawberry?", '“strawberry” has 3 r’s.');
      await ask('Can you help me?', 'Ask me what Timo built');
      await ask('Hey, can you help me?', 'Ask me what Timo built');
      expect(fakeFetch).not.toHaveBeenCalled();
      await ask('Anything else?', 'Which project or machine do you mean?');
      await ask('spotify', 'Self-hosted Spotify history');
      await ask('what languages?', 'Python');
      await ask('what langauge?', 'Python');
      await ask('what langauge spotify tracker?', 'Python');
      await ask('What languages does it use?', 'Python');
      await ask('what languages spotify tracker?', 'Python');
      await ask('in what programming language?', 'Python');
      await ask('anything else?', 'Reconciliation keeps the live listener');
      expect(
        panel
          .querySelector('[data-ask-reply]:last-child a')
          ?.getAttribute('href'),
      ).toBe('/projects/spotify-stats-tracker/');
      panel.querySelector('textarea')!.value = 'And who funded it?';
      panel.querySelector('form')!.dispatchEvent(new window.Event('submit'));
      await vi.waitFor(() =>
        expect(panel.querySelector('button')?.disabled).toBe(false),
      );
      const lookup = fakeFetch.mock.calls.find(([path]) => path === '/api/ask');
      expect(JSON.parse(String(lookup?.[1]?.body))).toMatchObject({
        question: 'who funded it? (SpotifyTracker)',
        history: expect.arrayContaining([
          { question: 'yo what up?', answer: expect.stringContaining('Timo') },
          {
            question: 'what languages spotify tracker?',
            answer: expect.stringContaining('Python'),
          },
          {
            question: 'in what programming language?',
            answer: expect.stringContaining('Python'),
          },
          {
            question: 'anything else?',
            answer: expect.stringContaining('Reconciliation'),
          },
        ]),
      });
      await ask('yo, tell me about heathcoul?', 'A couch co-op game in Unity.');
      expect(
        panel
          .querySelector('[data-ask-reply]:last-child a')
          ?.getAttribute('href'),
      ).toBe('/projects/hearthcoil/');
      await ask('Which GPU does the workstation use?', 'RTX 5090');
      const requests = fakeFetch.mock.calls.length;
      await ask('ah yes thats what i meant thanks', 'You’re welcome!');
      expect(fakeFetch).toHaveBeenCalledTimes(requests);
      await ask('And its CPU?', 'i7-13700K');
      await ask('Tell me about Hearthcoil', 'A couch co-op game in Unity.');
      await ask(
        'What did you say about SpotifyTracker earlier?',
        'Reconciliation keeps the live listener',
      );
      await ask(
        'Back to the machine with the RTX 5090, what CPU does it have?',
        'i7-13700K',
      );
      await ask('What did I ask first?', 'yo what up?');
      await ask(
        'What was your first answer?',
        'What do you wanna know about Timo or his work?',
      );
      expect(panel.querySelector('[data-ask-result]')?.textContent).toContain(
        'yo what up?',
      );
      expect(
        panel.querySelector('[data-ask-result]')?.textContent,
      ).not.toContain('i5-13500');
      panel
        .querySelector('[data-ask-reset]')!
        .dispatchEvent(new window.Event('click'));
      expect(
        panel.querySelector('[data-ask-result]')?.textContent,
      ).not.toContain('RTX 5090');
      await ask('What did I ask first?', 'I can’t find that in this chat.');
      await ask('And its CPU?', 'Which project or machine do you mean?');
      await ask(
        'Which GPU does the workstation use and which GPU does the dev server use?',
        'GPU AMD Radeon',
      );
      await ask(
        'And its CPU?',
        'Which one did you mean? Workstation or Dev-Server?',
      );
      await ask('the workstation', 'i7-13700K');
    } finally {
      vi.unstubAllGlobals();
      window.close();
    }
  });

  it.each([
    ['What can you help me with?', 'en', 'Ask me what Timo built'],
    ['I need help', 'en', 'Ask me what Timo built'],
    ['Kannst du mir bitte helfen?', 'de', 'Frag mich, was Timo gebaut hat'],
    ['Wobei kannst du mir helfen?', 'de', 'Frag mich, was Timo gebaut hat'],
    ['Ich brauche Hilfe', 'de', 'Frag mich, was Timo gebaut hat'],
  ] as const)(
    'treats %s as a request for help with the chat',
    (question, locale, reply) => {
      expect(socialReply(question, locale)).toContain(reply);
    },
  );

  it('aborts an in-flight lookup when a new chat starts', async () => {
    const window = new Window();
    try {
      vi.stubGlobal('document', window.document);
      let completeLookup!: (response: Response) => void;
      const lookup = new Promise<Response>((resolve) => {
        completeLookup = resolve;
      });
      const fetchIndex = vi.fn(() => lookup);
      vi.stubGlobal('fetch', fetchIndex);
      window.document.documentElement.lang = 'en';
      window.document.body.innerHTML =
        '<section data-mode="local" data-version="fixture"><div data-ask-result></div><form><textarea></textarea><button type="submit">Send</button><button type="button" data-ask-reset>New chat</button></form></section>';
      const panel = window.document.querySelector('section')!;
      panel.dataset.messages = JSON.stringify({
        wait: 'Thinking',
        source: 'From the site',
      });
      setupAskWork(panel as unknown as HTMLElement);
      const form = panel.querySelector('form')!;
      const input = panel.querySelector('textarea')!;
      input.value = 'Tell me about the homelab';
      form.dispatchEvent(new window.Event('submit'));
      expect(fetchIndex).toHaveBeenCalledTimes(1);
      panel
        .querySelector('[data-ask-reset]')!
        .dispatchEvent(new window.Event('click'));
      input.value = 'Hi';
      form.dispatchEvent(new window.Event('submit'));
      completeLookup(Response.json(index()));
      await new Promise((resolve) => setTimeout(resolve));
      expect(panel.querySelector('[data-ask-result]')?.textContent).toMatch(
        /HiHey!/,
      );
      expect(
        panel.querySelector('[data-ask-result]')?.textContent,
      ).not.toContain('I self-host');
    } finally {
      vi.unstubAllGlobals();
      window.close();
    }
  });

  it('starts a chat from a question button and leads with a sourced takeaway', async () => {
    const window = new Window();
    try {
      vi.stubGlobal('document', window.document);
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => Response.json(index())),
      );
      window.document.documentElement.lang = 'en';
      window.document.body.innerHTML = `
        <section data-mode="index" data-version="fixture">
          <div data-ask-result></div>
          <form hidden><p data-ask-topic hidden></p><textarea></textarea>
            <button type="submit">Ask</button><button type="button" data-ask-reset>New chat</button>
          </form>
          <div data-ask-actions></div>
          <div data-ask-starters hidden><button type="button" data-ask-prompt="Tell me about SpotifyTracker">SpotifyTracker</button></div>
          <div data-ask-static-examples>Examples</div>
        </section>`;
      const panel = window.document.querySelector('section')!;
      panel.dataset.messages = JSON.stringify({
        evidence: 'Supporting excerpts',
        topic: 'Talking about {subject}',
        wait: 'Looking…',
      });
      setupAskWork(panel as unknown as HTMLElement);
      const starters = panel.querySelector('[data-ask-starters]')!;
      const topic = panel.querySelector('[data-ask-topic]')!;
      expect(starters.hasAttribute('hidden')).toBe(false);
      expect(
        panel
          .querySelector('[data-ask-static-examples]')
          ?.hasAttribute('hidden'),
      ).toBe(true);
      starters.querySelector('button')?.click();
      expect(window.document.activeElement).toBe(
        panel.querySelector('textarea'),
      );
      await vi.waitFor(() =>
        expect(panel.querySelector('[data-ask-reply] > p')?.textContent).toBe(
          'SpotifyTracker saves listening history and shows listening stats for multiple users on a self-hosted instance.',
        ),
      );
      expect(topic.textContent).toBe('Talking about SpotifyTracker');
      expect(topic.hasAttribute('hidden')).toBe(false);
      const reply = panel.querySelector('[data-ask-reply]')!;
      expect(reply.querySelector('a')?.getAttribute('href')).toBe(
        '/projects/spotify-stats-tracker/',
      );
      expect(reply.querySelector('details')?.hasAttribute('open')).toBe(false);
      expect(reply.querySelector('details')?.textContent).toContain(
        'I rewrote the tracker',
      );
      expect(starters.hasAttribute('hidden')).toBe(true);
      panel
        .querySelector('[data-ask-actions]')
        ?.querySelector('button')
        ?.click();
      await vi.waitFor(() =>
        expect(
          panel.querySelector('[data-ask-reply]:last-child > p')?.textContent,
        ).toContain('SpotifyTracker is written in Python'),
      );
      panel
        .querySelector('[data-ask-reset]')
        ?.dispatchEvent(new window.Event('click'));
      expect(starters.hasAttribute('hidden')).toBe(false);
      expect(topic.hasAttribute('hidden')).toBe(true);
    } finally {
      vi.unstubAllGlobals();
      window.close();
    }
  });

  it('retries the local-only preview data and excludes it from selector history', async () => {
    const window = new Window();
    try {
      vi.stubGlobal('document', window.document);
      const marker = 'Private preview test marker.';
      let petsRequests = 0;
      const fakeFetch = vi.fn<typeof fetch>(async (path) => {
        if (path === '/ask-content-en.json') return Response.json(index());
        if (path === '/api/ask-local-pets') {
          petsRequests += 1;
          return petsRequests === 1
            ? new Response(null, { status: 503 })
            : Response.json({
                overview: { en: marker, de: marker },
                cats: [
                  { name: 'Widget', description: { en: marker, de: marker } },
                ],
              });
        }
        return Response.json(
          documentAnswer([], 'unknown', 'index', 'en', 'fixture'),
        );
      });
      vi.stubGlobal('fetch', fakeFetch);
      window.document.documentElement.lang = 'en';
      window.document.body.innerHTML =
        '<section data-mode="local" data-version="fixture" data-ask-local-pets="true"><div data-ask-result></div><form><textarea></textarea><button type="submit">Ask</button></form></section>';
      const panel = window.document.querySelector('section')!;
      panel.dataset.messages = JSON.stringify({ wait: 'Looking…' });
      setupAskWork(panel as unknown as HTMLElement);
      const ask = async (question: string) => {
        panel.querySelector('textarea')!.value = question;
        panel.querySelector('form')!.dispatchEvent(new window.Event('submit'));
        await vi.waitFor(() =>
          expect(panel.querySelector('button')?.disabled).toBe(false),
        );
      };
      await ask('Tell me about SpotifyTracker');
      await ask('Tell me about Widget');
      expect(
        panel.querySelector('[data-ask-reply]:last-child')?.textContent,
      ).toBe(marker);
      await ask('Which part of the Abacus workflow did he build?');
      const lookup = fakeFetch.mock.calls.find(([path]) => path === '/api/ask');
      const body = String(lookup?.[1]?.body);
      expect(body).toContain('Tell me about SpotifyTracker');
      expect(body).not.toContain(marker);
      expect(body).not.toContain('Tell me about Widget');
      expect(petsRequests).toBe(2);
    } finally {
      vi.unstubAllGlobals();
      window.close();
    }
  });

  it.each([
    [
      'Thanks, which GPU does the workstation use?',
      'RTX 5090',
      200,
      ['/ask-content-en.json', '/api/ask'],
      ['/homelab/'],
    ],
    [
      'usage of AI?',
      'Local language model inference at home.',
      503,
      ['/ask-content-en.json'],
      ['/homelab/', '/projects/hearthcoil/'],
    ],
    [
      'Tell me about the homelab?',
      'I self-host this website',
      503,
      ['/ask-content-en.json'],
      ['/homelab/'],
    ],
    [
      'How much RAM does the workstation have?',
      '32 GB DDR5',
      503,
      ['/ask-content-en.json', '/api/ask'],
      ['/homelab/'],
    ],
    [
      'Which GPU does the workstation use?',
      'RTX 5090',
      200,
      ['/ask-content-en.json', '/api/ask'],
      ['/homelab/'],
    ],
    [
      'How much RAM does the workstation have?',
      'Rate limited. Try again shortly.',
      429,
      ['/ask-content-en.json', '/api/ask'],
      ['/homelab/'],
    ],
    [
      'How is the website built and where is the website hosted?',
      'GitHub Actions',
      503,
      ['/ask-content-en.json', '/api/ask'],
      ['/projects/this-website/', '/homelab/'],
    ],
    [
      'Which GPU does the workstation use and how much did it cost?',
      'Evidence needed for “how much did it cost?”',
      503,
      ['/ask-content-en.json', '/api/ask'],
      ['/homelab/'],
    ],
  ] as const)(
    'uses public content through the form for %s',
    async (question, text, apiStatus, paths, citations) => {
      const window = new Window();
      try {
        vi.stubGlobal('document', window.document);
        const fakeFetch = vi.fn(async (path: string) => {
          if (path === '/ask-content-en.json') return Response.json(index());
          return apiStatus === 200
            ? Response.json(
                documentAnswer([], 'unknown', 'index', 'en', 'fixture'),
              )
            : new Response(null, { status: apiStatus });
        });
        vi.stubGlobal('fetch', fakeFetch);
        window.document.documentElement.lang = 'en';
        window.document.body.innerHTML =
          '<section data-mode="local" data-version="fixture"><form><textarea></textarea><button>Ask</button></form><div data-ask-result></div></section>';
        const panel = window.document.querySelector('section')!;
        panel.dataset.messages = JSON.stringify({
          source: 'From the site.',
          related: 'Related text from the site.',
          seePage: 'See the public page.',
          offline: 'Offline.',
          missing: 'Evidence needed for “{detail}”',
          limited: 'Rate limited. Try again shortly.',
        });
        setupAskWork(panel as unknown as HTMLElement);
        panel.querySelector('textarea')!.value = question;
        panel.querySelector('form')!.dispatchEvent(new window.Event('submit'));
        const result = panel.querySelector('[data-ask-result]')!;
        await vi.waitFor(() => expect(result.textContent).toContain(text));
        expect(
          Array.from(result.querySelectorAll('a'), (link) =>
            link.getAttribute('href'),
          ),
        ).toEqual(citations);
        expect(fakeFetch.mock.calls.map(([path]) => path)).toEqual(paths);
      } finally {
        vi.unstubAllGlobals();
        window.close();
      }
    },
  );
});
