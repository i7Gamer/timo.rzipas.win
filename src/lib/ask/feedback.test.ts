import { request, type Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGateway } from '../../../services/ask/server';
import { prepareQuestion } from '../../../services/ask/selection';
import { selectChatHistory, type ChatTurn } from './history';
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
      await open({ local: true, select });
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
    },
  );

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
    'What kind of cats does he have, and how old are they?',
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
