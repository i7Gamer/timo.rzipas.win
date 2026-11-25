import { request, type Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGateway } from '../../../services/ask/server';
import { prepareQuestion } from '../../../services/ask/selection';
import { selectChatHistory, type ChatTurn } from './history';
import { EXTENDED_PITCH_IDS } from './catalog';
import { careerAnchorIndex } from './career';

let gateway: Server | undefined;
let port = 0;

async function open(options: Parameters<typeof createGateway>[0] = {}) {
  gateway = createGateway({ local: false, ...options });
  await new Promise<void>((resolve) =>
    gateway!.listen(0, '127.0.0.1', resolve),
  );
  const address = gateway.address();
  if (!address || typeof address === 'string')
    throw new Error('Missing gateway address');
  port = address.port;
}

function ask(
  question: string,
  locale: 'en' | 'de' = 'en',
  history: ChatTurn[] = [],
) {
  return new Promise<{
    status: number;
    body: {
      locale?: string;
      status?: string;
      summary?: string;
      claims?: { id: string; text: string }[];
      sources?: { href: string }[];
    };
  }>((resolve, reject) => {
    const req = request(
      {
        host: '127.0.0.1',
        port,
        path: '/api/ask',
        method: 'POST',
        headers: {
          Host: '127.0.0.1:4511',
          Origin: 'http://127.0.0.1:4511',
          'Content-Type': 'application/json',
        },
      },
      (response) => {
        let text = '';
        response.setEncoding('utf8').on('data', (chunk) => (text += chunk));
        response.on('end', () =>
          resolve({
            status: response.statusCode ?? 0,
            body: JSON.parse(text),
          }),
        );
      },
    ).on('error', reject);
    req.end(JSON.stringify({ question, locale, history }));
  });
}

afterEach(async () => {
  if (gateway)
    await new Promise<void>((resolve) => gateway!.close(() => resolve()));
  gateway = undefined;
});

describe('portfolio Ask feedback regressions', () => {
  it.each([true, false])(
    'only accepts a model-led pitch with all approved paragraphs (%s)',
    async (complete) => {
      const ids = [...EXTENDED_PITCH_IDS].reverse();
      const summarize = vi.fn(async () => ({
        ids: complete ? ids : ids.slice(0, -1),
      }));
      await open({ local: true, summarize });
      const reply = (await ask('give me good 200 word pitch about timo')).body;
      expect(reply).toMatchObject({
        status: 'answer',
        mode: complete ? 'local' : 'index',
      });
      expect(reply.claims?.map(({ id }) => id)).toEqual(
        complete ? ids : EXTENDED_PITCH_IDS,
      );
      expect(summarize).toHaveBeenCalledOnce();
    },
  );

  it.each([
    ['en', 'summary of his CV'],
    ['de', 'Kurze Zusammenfassung von Timos Lebenslauf'],
  ] as const)('summarizes the public CV in %s', async (locale, question) => {
    await open();
    expect((await ask(question, locale)).body).toMatchObject({
      status: 'answer',
      claims: [
        { id: 'career-role-titles' },
        { id: 'cv-degree' },
        { id: 'cv-matura' },
      ],
      sources: expect.arrayContaining([
        expect.objectContaining({ href: '/about/' }),
      ]),
    });
  });

  it('keeps both public education entries when the model omits one', async () => {
    const summarize = vi.fn(async () => ({
      ids: ['career-role-titles', 'cv-matura'],
    }));
    await open({ local: true, summarize });
    expect((await ask('Summary of his CV')).body).toMatchObject({
      mode: 'index',
      claims: [
        { id: 'career-role-titles' },
        { id: 'cv-degree' },
        { id: 'cv-matura' },
      ],
    });
    expect(summarize).toHaveBeenCalledOnce();
  });

  it.each([
    ['en', 'summary of projects', 'anything else?'],
    ['de', 'Zusammenfassung von Timos Projekten', 'Und sonst noch?'],
  ] as const)(
    'continues a project summary with fresh project evidence in %s',
    async (locale, question, followUp) => {
      await open();
      const first = (await ask(question, locale)).body;
      expect(first).toMatchObject({
        status: 'answer',
        claims: [
          { id: 'spotify-rewrite' },
          { id: 'myspeed-fork' },
          { id: 'tutto-modes' },
        ],
      });
      expect(
        (
          await ask(followUp, locale, [
            {
              question,
              answer: first.claims!.map(({ text }) => text).join(' '),
            },
          ])
        ).body,
      ).toMatchObject({
        status: 'answer',
        claims: [
          { id: 'hearthcoil-game' },
          { id: 'bachelor-contribution' },
          { id: 'carini-team' },
        ],
      });
    },
  );

  it.each([
    ['en', 'give me good 200 word pitch about timo', 'this is not 200 words'],
    [
      'de',
      'Schreib mir einen Pitch über Timo in etwa 200 Wörtern',
      'Das sind keine 200 Wörter.',
    ],
  ] as const)(
    'answers a length-specific pitch and its correction in %s',
    async (locale, question, correction) => {
      await open();
      const first = (await ask(question, locale)).body;
      const revised = (
        await ask(correction, locale, [{ question, answer: 'Short draft.' }])
      ).body;
      for (const answer of [first, revised]) {
        expect(answer.status).toBe('answer');
        const words = answer
          .claims!.map(({ text }) => text)
          .join(' ')
          .trim()
          .split(/\s+/u).length;
        expect(words).toBeGreaterThanOrEqual(190);
        expect(words).toBeLessThanOrEqual(215);
        if (locale === 'en') expect(words).toBe(200);
        expect(answer.sources).toEqual(
          expect.arrayContaining(
            [
              '/about/',
              '/projects/spotify-stats-tracker/',
              '/projects/hearthcoil/',
            ].map((href) => expect.objectContaining({ href })),
          ),
        );
      }
    },
  );

  it.each([
    ['en', 'Which project used Flask? Who won the World Cup?'],
    ['en', 'Which project used Flask and who won the World Cup?'],
    ['en', 'Which project used Flask? Did Timo invent Flask?'],
    ['de', 'Wofür hat Timo Flask eingesetzt? Wer gewann die Fussball-WM?'],
    ['de', 'Welches Projekt nutzte Flask und wer gewann die Fussball-WM?'],
    ['de', 'Wofür hat Timo Flask eingesetzt? Hat er Flask erfunden?'],
  ] as const)(
    'checks separate %s questions before accepting a model claim of completeness',
    async (locale, question) => {
      await open({
        local: true,
        select: async (_question, _locale, candidates) => ({
          status: 'answer',
          slots: [
            candidates.findIndex(({ id }) => id === 'spotify-python') + 1,
          ],
        }),
      });
      expect((await ask(question, locale)).body).toMatchObject({
        status: 'partial',
        mode: 'local',
        missing: 'additional-question',
        claims: [{ id: 'spotify-python' }],
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
    'combines both exact reviewed clauses in %s',
    async (locale, question) => {
      const select = vi.fn();
      await open({ local: true, select });
      expect((await ask(question, locale)).body).toMatchObject({
        status: 'answer',
        mode: 'index',
        claims: [
          { id: 'portfolio-website-architecture' },
          { id: 'abacus-workflow' },
        ],
        sources: [
          { href: '/projects/this-website/' },
          { href: '/about/#abacus' },
        ],
      });
      expect(select).not.toHaveBeenCalled();
    },
  );

  it.each(['en', 'de'] as const)(
    'rejects invented %s summary prose with valid claim IDs',
    async (locale) => {
      const summarize = vi.fn(async () => ({
        ids: ['portfolio-pitch', 'portfolio-project-inventory'],
        summary: 'Timo invented Flask.',
      }));
      await open({ local: true, summarize });
      const question =
        locale === 'en'
          ? 'Give me a nice summary of all Timo does'
          : 'Fass bitte zusammen, was Timo alles macht.';
      const response = await ask(question, locale);
      expect(response.body).toMatchObject({
        status: 'answer',
        mode: 'index',
        claims: [
          { id: 'career-role-titles' },
          { id: 'portfolio-project-inventory' },
          { id: 'portfolio-pitch' },
        ],
      });
      expect(response.body).not.toHaveProperty('summary');
      expect(summarize).toHaveBeenCalledOnce();
    },
  );
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
    'reports actual coverage of standalone clauses in %s',
    async (locale, hosting, languages, unrelated) => {
      await open();
      const mixed = await ask(`${hosting} ${unrelated}`, locale);
      expect(mixed.body).toMatchObject({
        status: 'partial',
        missing: 'additional-question',
        claims: [{ id: 'portfolio-website-architecture' }],
        sources: [{ href: '/projects/this-website/' }],
      });
      const both = await ask(`${hosting} ${languages}`, locale);
      expect(both.body).toMatchObject({
        status: 'answer',
        claims: [
          { id: 'portfolio-website-architecture' },
          { id: 'portfolio-spoken-languages' },
        ],
        sources: [{ href: '/projects/this-website/' }, { href: '/about/' }],
      });
      expect(both.body).not.toHaveProperty('missing');
      const unsupported = await ask(
        `${unrelated} ${locale === 'de' ? 'Wie alt ist der Mond?' : 'How old is the moon?'}`,
        locale,
      );
      expect(unsupported.body).toMatchObject({
        status: 'unknown',
        claims: [],
        sources: [],
      });
    },
  );
  it('retains the grounded employer anchor when long history is shortened', async () => {
    await open();
    const question = 'What do you work on at Abacus?';
    const initial = await ask(question);
    const anchor = { question, answer: initial.body.claims![0].text };
    const followUp = 'Tell me more';
    const turns = [
      anchor,
      ...Array.from({ length: 12 }, () => ({
        question: followUp,
        answer: 'An earlier turn in the conversation. '.repeat(10),
      })),
    ];
    const history = selectChatHistory(
      turns,
      followUp,
      careerAnchorIndex(turns),
    );
    expect(history[0]).toEqual(anchor);
    expect(history.length).toBeLessThan(turns.length);
    expect(
      (await ask(followUp, 'en', history)).body.claims?.map(({ id }) => id),
    ).toEqual(['abacus-tests']);
  });
  it.each([
    ['en', 'Anything that did not work out? Any holes in his CV?', 'cv-gaps'],
    [
      'de',
      'Was hat bei seinen Projekten nicht funktioniert? Lücken im Lebenslauf?',
      'cv-gaps',
    ],
    [
      'en',
      'What did the maintainer question in the upstream SpotifyTracker contribution? What was the budget?',
      'additional-question',
    ],
    [
      'de',
      'Was hinterfragte der Maintainer beim Upstream-Beitrag zu SpotifyTracker, und wie hoch war das Budget?',
      'additional-question',
    ],
  ] as const)(
    'identifies an unanswered clause in %s: %s',
    async (locale, question, missing) => {
      await open();
      expect((await ask(question, locale)).body).toMatchObject({
        status: 'partial',
        missing,
        claims: [{ id: 'spotify-upstream-review' }],
        sources: [{ href: '/projects/spotify-stats-tracker/#upstream-import' }],
      });
    },
  );

  it('answers two reviewed clauses without marking either as missing', async () => {
    await open();
    const result = await ask(
      'What did the maintainer question in the upstream SpotifyTracker contribution? What languages does Timo speak?',
    );
    expect(result.body).toMatchObject({
      status: 'answer',
      claims: [
        { id: 'spotify-upstream-review' },
        { id: 'portfolio-spoken-languages' },
      ],
    });
    expect(result.body).not.toHaveProperty('missing');
  });

  it.each([
    [
      'What do you work on at Abacus?',
      'abacus-workflow',
      'abacus-tests',
      'abacus-jenkins',
    ],
    [
      'What did Timo do at Stadler?',
      'stadler-vpn',
      'stadler-plugins',
      'early-stadler',
    ],
  ] as const)(
    'keeps successive employer details scoped after %s',
    async (question, first, next, later) => {
      await open();
      const initial = await ask(question);
      expect(initial.body.claims?.map(({ id }) => id)).toEqual([first]);
      const history: ChatTurn[] = [
        { question, answer: initial.body.claims![0].text },
      ];
      for (const id of [next, later]) {
        const response = await ask('Tell me more', 'en', history);
        expect(response.body.claims?.map((claim) => claim.id)).toEqual([id]);
        history.push({
          question: 'Tell me more',
          answer: response.body.claims![0].text,
        });
      }
      const switched = await ask('Other roles', 'en', history);
      expect(switched.body.claims?.map(({ id }) => id)).toContain('tutoring');
    },
  );

  it('abstains when the selected topic supports neither of two claims', async () => {
    await open({
      local: true,
      select: async (_question, _locale, candidates) => ({
        status: 'answer',
        slots: [candidates.findIndex(({ id }) => id === 'spotify-python') + 1],
      }),
    });
    expect(
      (await ask('Did Timo invent Flask and who won the World Cup?')).body,
    ).toMatchObject({
      status: 'unknown',
      mode: 'local',
      claims: [],
      sources: [],
    });
  });

  it.each([
    [
      'en',
      'work',
      'more?',
      'more about work',
      'thats the same again tell me more',
    ],
    [
      'de',
      'Arbeit',
      'Noch mehr?',
      'Mehr über die Arbeit',
      'Das hast du schon gesagt. Erzähl mir mehr',
    ],
  ] as const)(
    'keeps work follow-ups fresh with the selector unavailable in %s',
    async (locale, ...questions) => {
      const select = vi.fn(async () => {
        throw new Error('Model offline');
      });
      await open({ local: true, select });
      const history: ChatTurn[] = [];
      const seen = new Set<string>();
      for (const question of questions) {
        const response = await ask(question, locale, history);
        expect(response.status, question).toBe(200);
        expect(response.body.status, question).toBe('answer');
        const claims = response.body.claims ?? [];
        expect(claims.length, question).toBeGreaterThan(0);
        for (const { id } of claims) {
          expect(id).not.toBe('current-work');
          expect(seen.has(id), `${question}: ${id}`).toBe(false);
          seen.add(id);
        }
        history.push({
          question,
          answer: claims.map(({ text }) => text).join(' '),
        });
      }
      expect(seen).toContain('abacus-workflow');
      expect(seen).toContain('stadler-vpn');
      expect(seen).toContain('tutoring');
      expect(select).toHaveBeenCalled();
    },
  );

  it('lets the model choose a public highlight even without a named project', async () => {
    const select = vi.fn(async () => ({ status: 'answer', slots: [2] }));
    await open({ local: true, select });
    const response = await ask('most interesting detail please');
    expect(select.mock.calls).toHaveLength(1);
    expect(response.body).toMatchObject({
      status: 'answer',
      claims: [{ id: 'spotify-reconciliation-example' }],
      sources: [{ href: '/projects/spotify-stats-tracker/' }],
    });
  });

  it('continues a pitch with new examples and keeps work follow-ups scoped', async () => {
    await open();
    const history: ChatTurn[] = [];
    const turns = [
      ['short pitch about timo', ['portfolio-pitch']],
      ['any more details?', ['hearthcoil-launcher-playtest']],
      [
        'more about his work',
        ['abacus-workflow', 'stadler-vpn', 'stadler-plugins'],
      ],
    ] as const;
    for (const [question, expectedIds] of turns) {
      const response = await ask(question, 'en', history);
      expect(response.body.status).toBe('answer');
      expect(response.body.claims?.map(({ id }) => id)).toEqual(expectedIds);
      history.push({
        question,
        answer: response.body.claims!.map(({ text }) => text).join(' '),
      });
    }
  });

  it.each([
    ['list all timos work and projects', 'en'],
    ['Liste alle Jobs und Projekte von Timo auf', 'de'],
  ] as const)(
    'cites the full public inventory for %s',
    async (question, locale) => {
      const select = vi.fn(async () => ({ status: 'unknown', slots: [] }));
      const summarize = vi.fn(async () => null);
      await open({ local: true, select, summarize });
      const response = await ask(question, locale);
      expect(response.body).toMatchObject({
        status: 'answer',
        claims: [
          { id: 'career-role-titles' },
          { id: 'portfolio-project-inventory' },
        ],
        sources: [{ href: '/about/' }, { href: '/projects/' }],
      });
      expect(select).not.toHaveBeenCalled();
      expect(summarize).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['en', 'give me a nice summary of all work and projects'],
    ['en', 'summarize all his work and projects nicely'],
    ['en', 'nice summary of work and projects'],
    ['en', 'Could you sum up all of his projects and work experience briefly?'],
    ['en', 'give me a nice summary of all timo does'],
    ['en', 'Could you summarize his projects and work experience?'],
    [
      'de',
      'Gib mir bitte eine kurze Zusammenfassung von Timos Arbeit und Projekten.',
    ],
    ['de', 'Fass bitte zusammen, was Timo alles macht.'],
    ['de', 'Kurze Zusammenfassung von Arbeit und Projekten bitte'],
  ] as const)(
    'uses reviewed wording in a %s summary for %s',
    async (locale, question) => {
      const ids = ['portfolio-project-inventory', 'portfolio-pitch'];
      const summarize = vi.fn(async () => ({ ids }));
      const select = vi.fn();
      await open({ local: true, select, summarize });
      const response = await ask(question, locale);
      expect(response).toMatchObject({
        status: 200,
        body: {
          mode: 'local',
          status: 'answer',
          sources: [{ href: '/projects/' }, { href: '/about/' }],
        },
      });
      expect(response.body.claims?.map(({ id }) => id)).toEqual(ids);
      expect(response.body).not.toHaveProperty('summary');
      expect(summarize).toHaveBeenCalledExactlyOnceWith(
        locale,
        expect.arrayContaining(
          ids.map((id) => expect.objectContaining({ id })),
        ),
        expect.any(AbortSignal),
      );
      expect(select).not.toHaveBeenCalled();
    },
  );

  it.each([
    'Summarize all his work and projects at Google nicely.',
    'Nice summary of work and projects before 2020.',
  ])(
    'preserves scope and abstains on unsupported summary %s',
    async (question) => {
      const summarize = vi.fn(async () => 'An unrelated career summary.');
      const select = vi.fn(async () => ({ status: 'unknown', slots: [] }));
      await open({ local: true, select, summarize });
      expect((await ask(question)).body).toMatchObject({
        status: 'unknown',
        claims: [],
      });
      expect(summarize).not.toHaveBeenCalled();
      expect(select).toHaveBeenCalledOnce();
    },
  );

  it('uses the dated public update for a summary of current activity', async () => {
    const summarize = vi.fn(async () => ({ ids: ['current-work'] }));
    await open({ local: true, summarize });
    const response = await ask('give me a nice summary of all timo is doing');
    expect(response).toMatchObject({
      status: 200,
      body: {
        mode: 'local',
        status: 'answer',
        claims: [{ id: 'current-work' }],
        sources: [{ href: '/about/#current-work' }],
      },
    });
    expect(summarize).toHaveBeenCalledExactlyOnceWith(
      'en',
      response.body.claims,
      expect.any(AbortSignal),
    );
  });

  it('gives summaries more time without slowing direct questions or extending selection', async () => {
    const deadline = vi.spyOn(AbortSignal, 'timeout');
    const summarize = vi.fn(async () => ({
      ids: ['portfolio-pitch', 'portfolio-project-inventory'],
    }));
    const select = vi.fn(async () => ({ status: 'answer', slots: [1] }));
    try {
      await open({ local: true, summarize, select });
      expect((await ask('What languages does Timo speak?')).body).toMatchObject(
        { mode: 'index' },
      );
      expect(deadline).not.toHaveBeenCalled();
      expect((await ask('Which project used Flask?')).body).toMatchObject({
        mode: 'local',
      });
      expect(
        (await ask('nice summary of work and projects')).body,
      ).toMatchObject({ mode: 'local' });
      expect(deadline.mock.calls).toEqual([[6_000], [8_000]]);
    } finally {
      deadline.mockRestore();
    }
  });

  it.each(['offline', 'invalid', 'late', 'index-only'] as const)(
    'keeps the reviewed summary fallback when generation is %s',
    async (kind) => {
      const summarize = vi.fn(async () => {
        if (kind === 'offline') throw new Error('Model unavailable');
        if (kind === 'late') {
          await new Promise((resolve) => setTimeout(resolve, 20));
          return { ids: ['portfolio-pitch', 'portfolio-project-inventory'] };
        }
        return { ids: ['portfolio-pitch'] };
      });
      await open({ local: kind !== 'index-only', summarize, timeout: 5 });
      const response = await ask('give me a nice summary of all timo does');
      expect(response).toMatchObject({
        status: 200,
        body: { mode: 'index', status: 'answer' },
      });
      expect(response.body).not.toHaveProperty('summary');
      expect(response.body.sources).toEqual(
        expect.arrayContaining(
          [{ href: '/about/' }, { href: '/projects/' }].map((source) =>
            expect.objectContaining(source),
          ),
        ),
      );
      expect(summarize).toHaveBeenCalledTimes(kind === 'index-only' ? 0 : 1);
    },
  );

  it.each([
    ['en', 'can you tell me about opensource?'],
    ['de', 'kannst du mir was über opensource sagen?'],
  ] as const)(
    'offers both open-source contributions to the model in %s',
    async (locale, question) => {
      const summarize = vi.fn(async () => ({
        ids: ['myspeed-fork', 'spotify-upstream-review'],
      }));
      await open({ local: true, summarize });
      const response = await ask(question, locale);
      expect(response).toMatchObject({
        status: 200,
        body: {
          mode: 'local',
          claims: [{ id: 'myspeed-fork' }, { id: 'spotify-upstream-review' }],
        },
      });
      expect(summarize).toHaveBeenCalledOnce();
    },
  );

  it('keeps evidence selection available after the optional writer exhausts its budget', async () => {
    const summarize = vi.fn(async () => null);
    const select = vi.fn(async () => ({ status: 'answer', slots: [1] }));
    await open({ local: true, summarize, select });
    const budget = 60;
    const interval = 31_000;
    let now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockImplementation(() => now);
    try {
      for (let attempt = 0; attempt <= budget; attempt += 1) {
        expect(
          (await ask('Give me a nice summary of all Timo does')).body,
        ).toMatchObject({ mode: 'index', status: 'answer' });
        now += interval;
      }
      const response = await ask('Which project used Flask?');
      expect(response.body).toMatchObject({
        status: 'answer',
        mode: 'local',
        claims: [{ id: 'spotify-python' }],
      });
      expect(summarize).toHaveBeenCalledTimes(budget);
      expect(select).toHaveBeenCalledOnce();
    } finally {
      clock.mockRestore();
    }
  });

  it('keeps summaries available during evidence selector cooldown', async () => {
    const summarize = vi.fn(async () => ({
      ids: ['portfolio-pitch', 'portfolio-project-inventory'],
    }));
    await open({
      local: true,
      summarize,
      select: async () => {
        throw new Error('Selector unavailable');
      },
    });
    for (let attempt = 0; attempt < 2; attempt += 1)
      expect((await ask('Which project used Flask?')).status).toBe(503);
    expect(
      (await ask('Give me a nice summary of all Timo does')).body,
    ).toMatchObject({
      mode: 'local',
      claims: [
        { id: 'portfolio-pitch' },
        { id: 'portfolio-project-inventory' },
      ],
    });
  });

  it('does not contact Ollama for a reviewed summary when the writer is off', async () => {
    const modelFetch = vi.fn();
    vi.stubEnv('ASK_SUMMARIES', 'off');
    vi.stubGlobal('fetch', modelFetch);
    try {
      await open({ local: true });
      expect(
        (await ask('Nice summary of work and projects')).body,
      ).toMatchObject({ mode: 'index', status: 'answer' });
      expect(modelFetch).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    }
  });

  it('excludes highlights already shown after a broad profile question', async () => {
    await open();
    const question = 'Tell me one interesting fact about Timo';
    const first = await ask(question);
    expect(first.body.claims?.[0]?.id).toBe('hearthcoil-launcher-playtest');
    const next = await ask('Any more details?', 'en', [
      {
        question,
        answer: first.body.claims![0].text.split(/(?<=[.!?])\s+/)[0],
      },
    ]);
    expect(next.body.claims?.[0]?.id).toBe('spotify-reconciliation-example');
  });

  it.each([
    ['education', ['cv-degree', 'cv-matura']],
    ['leisure', ['portfolio-leisure']],
    ['motivation for homelab', ['homelab-motivation']],
    [
      'why should i hire him?',
      ['abacus-workflow', 'stadler-vpn', 'spotify-python'],
    ],
    ['what happened in 2015–2016?', ['cv-2015-2016']],
  ])('selects the reviewed evidence for %s', async (question, expectedIds) => {
    await open();
    const response = await ask(question);
    expect(response.status).toBe(200);
    expect(response.body.claims?.map(({ id }) => id)).toEqual(expectedIds);
  });

  it('covers work and project evidence in a broad hiring question with the model online', async () => {
    await open({
      local: true,
      select: async () => ({ slots: [3], status: 'answer' }),
    });
    const response = await ask('Why should I hire you?');
    expect(response.body.claims?.map(({ id }) => id)).toEqual([
      'abacus-workflow',
      'stadler-vpn',
      'spotify-python',
    ]);
  });

  it('answers the documented setback and leaves the unspecific CV gap open', async () => {
    await open();
    const response = await ask(
      'Anything that did not work out? Any holes in his CV?',
    );
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'partial',
      claims: [{ id: 'spotify-upstream-review' }],
    });
  });

  it('distinguishes the upstream maintainer review from Timo’s rewrite', async () => {
    await open();
    const response = await ask(
      'What did the maintainer question in Timo’s upstream Spotify contribution?',
    );
    expect(response.body).toMatchObject({
      status: 'answer',
      claims: [
        {
          id: 'spotify-upstream-review',
          text: expect.stringContaining('sorting'),
        },
      ],
      sources: [{ href: '/projects/spotify-stats-tracker/#upstream-import' }],
    });
  });

  it('keeps a German follow-up scoped to the public homelab', async () => {
    await open();
    const response = await ask('Warum?', 'de', [
      { question: 'Homelab', answer: 'Timo hostet seine Website selbst.' },
    ]);
    expect(response.body).toMatchObject({
      status: 'answer',
      locale: 'de',
      claims: [
        { id: 'homelab-motivation', text: expect.stringContaining('Backups') },
      ],
      sources: [{ href: '/homelab/' }],
    });
  });

  it('uses the approved cat details for a short follow-up', async () => {
    await open();
    const response = await ask('What kind?', 'en', [
      { question: 'Pets', answer: 'Timo has three cats.' },
    ]);
    expect(response.body.claims?.map(({ id }) => id)).toEqual([
      'about.cats.rudi',
      'about.cats.georgi',
      'about.cats.benji',
    ]);
  });

  it.each([
    'How old are Timo’s cats?',
    'Tell me all the negatives about him.',
    'What are Timo’s flaws?',
  ])(
    'abstains instead of inventing unsupported personal details: %s',
    async (question) => {
      await open();
      const response = await ask(question);
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ status: 'unknown', claims: [] });
    },
  );

  it('answers the approved cat details and leaves their ages unanswered', async () => {
    await open();
    const response = await ask(
      'What kind of cats does he have, and how old are they?',
    );
    expect(response.body).toMatchObject({
      status: 'partial',
      missing: 'additional-question',
      claims: [
        { id: 'about.cats.rudi' },
        { id: 'about.cats.georgi' },
        { id: 'about.cats.benji' },
      ],
    });
  });

  it.each([
    'Negative things about Timo',
    'What are his weak points?',
    'What are the downsides of hiring Timo?',
  ])('keeps unrelated facts out of model retrieval for %s', (question) => {
    const result = prepareQuestion(question, 'en');
    expect(result.fallback).toMatchObject({ status: 'unknown', claims: [] });
    expect(result.candidates).toEqual([]);
    expect(result.semanticPool).toEqual([]);
    expect(result.allowBroadSearch).toBeFalsy();
  });
});
