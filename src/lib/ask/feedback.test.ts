import { request, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { createGateway } from '../../../services/ask/server';
import { prepareQuestion } from '../../../services/ask/selection';
import type { ChatTurn } from './history';

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
