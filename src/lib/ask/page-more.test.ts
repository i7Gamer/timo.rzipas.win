import { Window } from 'happy-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_CLAIMS } from './catalog';
import { setupAskWork } from './browser';
import {
  findSiteContent,
  parseSiteContent,
  sectionDigests,
  type SitePage,
} from './site-content';

const HOMELAB: SitePage = {
  href: '/homelab/',
  title: 'Homelab',
  overview: [
    'Programming is half the story. The other half is the infrastructure it runs on.',
    'Running services myself means understanding the whole stack.',
  ],
  sections: [
    {
      heading: 'homelab',
      paragraphs: [
        'Programming is half the story. The other half is the infrastructure it runs on.',
      ],
    },
    { heading: 'Hardware', paragraphs: [] },
    {
      heading: 'Hardware › Server',
      paragraphs: ['Always on: hosts this site', 'CPU Intel Core i5-13500'],
    },
    {
      heading: 'Hardware › Workstation',
      paragraphs: ['Daily driver: coding, gaming', 'Memory 32 GB DDR5'],
    },
    {
      heading: 'How a request reaches this page',
      paragraphs: ['Visitor', 'Cloudflare · DNS + TLS', 'Astro static files'],
    },
    {
      heading: 'Why self-host?',
      paragraphs: [
        'Running services myself means understanding the whole stack.',
      ],
    },
    {
      heading: 'Running services',
      paragraphs: ['Services are checked every few minutes.', '6 services'],
    },
    { heading: 'Running services › Built by me', paragraphs: ['2 services'] },
    {
      heading: 'Running services › Built by me › MySpeed',
      paragraphs: ['Speed history of my connection.'],
    },
    {
      heading: 'Running services › Built by me › Tutto',
      paragraphs: ['My Tutto card game.'],
    },
    {
      heading: 'Running services › Monitoring',
      paragraphs: ['1 services'],
    },
    {
      heading: 'Running services › Monitoring › Grafana',
      paragraphs: ['Dashboards for everything.'],
    },
    {
      heading: 'Backups',
      paragraphs: ['Nightly', 'Backups run every night to the bulk storage.'],
    },
  ],
};

const HARDWARE =
  'Hardware: Server — Always on: hosts this site; Workstation — Daily driver: coding, gaming';
const REQUEST_PATH =
  'How a request reaches this page: Visitor; Cloudflare · DNS + TLS; Astro static files';
const SERVICES =
  'Running services: Built by me: MySpeed, Tutto; Monitoring: Grafana';
const BACKUPS = 'Backups run every night to the bulk storage.';

const index = (locale: 'en' | 'de' = 'en') =>
  parseSiteContent({ locale, pages: [HOMELAB] }, locale)!;
const subject = { href: HOMELAB.href, label: HOMELAB.title };
const INTRO = HOMELAB.overview[0];
const overviewTurn = {
  question: 'Tell me about the homelab',
  answer: 'Timo runs this portfolio on a server he built.',
};
const excerpts = (answer: ReturnType<typeof findSiteContent>) =>
  answer?.sources.flatMap(({ excerpts }) => excerpts);

describe('“more” about a remembered page', () => {
  it.each(['more', 'tell me more', 'anything else', 'mehr', 'noch mehr'])(
    'continues %j with the next unseen sections in page order',
    (question) => {
      const answer = findSiteContent(question, index(), 'related', subject, [
        overviewTurn,
      ]);
      expect(answer?.status).toBe('answer');
      expect(excerpts(answer)).toEqual([INTRO, HARDWARE, REQUEST_PATH]);
      expect(answer?.subjects).toEqual([
        expect.objectContaining({ href: HOMELAB.href }),
      ]);
    },
  );

  it('shows at most the claim limit per reply', () => {
    const answer = findSiteContent('more', index(), 'related', subject, [
      overviewTurn,
    ]);
    expect(excerpts(answer)!.length).toBeLessThanOrEqual(MAX_CLAIMS);
  });

  it('continues after the sections shown in an earlier “more”', () => {
    const answer = findSiteContent('more', index(), 'related', subject, [
      overviewTurn,
      { question: 'more', answer: [INTRO, HARDWARE, REQUEST_PATH].join(' ') },
    ]);
    expect(excerpts(answer)).toEqual([HOMELAB.overview[1], SERVICES, BACKUPS]);
  });

  it('shows collapsed supporting excerpts again, as they may be unread', () => {
    const turnWithEvidence = { ...overviewTurn, evidence: HOMELAB.overview };
    const answer = findSiteContent('more', index(), 'related', subject, [
      turnWithEvidence,
    ]);
    expect(excerpts(answer)?.[0]).toBe(INTRO);
  });

  it.each([
    ['en', /everything.*Homelab/],
    ['de', /alles.*Homelab/],
  ] as const)(
    'says in %s that everything was shown, with the page link',
    (locale, note) => {
      const answer = findSiteContent(
        'more',
        index(locale),
        'related',
        subject,
        [
          overviewTurn,
          {
            question: 'more',
            answer: [
              ...HOMELAB.overview,
              HARDWARE,
              REQUEST_PATH,
              SERVICES,
              BACKUPS,
            ].join(' '),
          },
        ],
      );
      expect(answer?.status).toBe('answer');
      expect(answer?.note).toMatch(note);
      expect(answer?.sources).toEqual([
        expect.objectContaining({ href: HOMELAB.href, excerpts: [] }),
      ]);
    },
  );
});

describe('section digests', () => {
  it('skips empty sections and names subsections without text', () => {
    expect(
      sectionDigests({
        href: '/x/',
        title: 'X',
        overview: [],
        sections: [
          { heading: 'Empty', paragraphs: [] },
          { heading: 'Tools', paragraphs: [] },
          { heading: 'Tools › Docker', paragraphs: [] },
          { heading: 'Tools › Git', paragraphs: ['Version control'] },
        ],
      }),
    ).toEqual(['Tools: Docker; Git — Version control']);
  });
});

describe('“more” in the chat', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('answers locally from the page without asking the model', async () => {
    const window = new Window({ url: 'http://127.0.0.1:4511/' });
    try {
      const fetchMock = vi.fn<typeof fetch>(async (input) => {
        if (String(input) === '/ask-content-en.json')
          return Response.json({ locale: 'en', pages: [HOMELAB] });
        return new Response(null, { status: 503 });
      });
      vi.stubGlobal('fetch', fetchMock);
      vi.stubGlobal('document', window.document);
      window.document.documentElement.lang = 'en';
      window.document.body.innerHTML = `<section data-mode="local" data-version="fixture"><div data-ask-result></div><div data-ask-actions></div><form><textarea></textarea><button type="submit">Ask</button></form></section>`;
      const panel = window.document.querySelector(
        'section',
      )! as unknown as HTMLElement;
      panel.dataset.messages = JSON.stringify({ wait: '…', offline: 'Off.' });
      setupAskWork(panel);
      const ask = async (question: string) => {
        const count = panel.querySelectorAll('[data-ask-reply]').length;
        panel.querySelector('textarea')!.value = question;
        panel
          .querySelector('form')!
          .dispatchEvent(new window.Event('submit') as unknown as Event);
        await vi.waitFor(() =>
          expect(panel.querySelectorAll('[data-ask-reply]')).toHaveLength(
            count + 1,
          ),
        );
        await vi.waitFor(() =>
          expect(panel.querySelector('button')!.disabled).toBe(false),
        );
        return panel.querySelectorAll('[data-ask-reply]')[count]!.textContent;
      };
      const modelCalls = () =>
        fetchMock.mock.calls.filter(([input]) => String(input) === '/api/ask')
          .length;
      await ask('Tell me about the homelab');
      const before = modelCalls();
      expect(await ask('more')).toContain(HARDWARE);
      const next = await ask('tell me more');
      expect(next).toContain(BACKUPS);
      expect(next).not.toContain(HARDWARE);
      expect(modelCalls()).toBe(before);
    } finally {
      await window.happyDOM.close();
    }
  });
});
