import { request, type Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGateway } from '../../../services/ask/server';
import { corpusVersion } from './version';

const ORIGIN = 'http://127.0.0.1:4511';
const HEADER = 'x-ask-model-calls';
const MINUTE_MS = 60_000;
const INFERENCE_LIMIT = 60;
const RETRIEVALS_PER_MINUTE = 4;
const modelQuestion = 'Where did Timo use Python and Flask?';
const abstention = 'What is the capital of Canada?';
const rankedQuestion =
  'How did the thesis tool account for uncertainty in activity durations?';

let gateway: Server | undefined;
let port: number;

const ask = (question: string) => JSON.stringify({ question, locale: 'en' });

async function open(options?: Parameters<typeof createGateway>[0]) {
  gateway = createGateway(options);
  await new Promise<void>((resolve) =>
    gateway!.listen(0, '127.0.0.1', resolve),
  );
  const address = gateway.address();
  if (!address || typeof address === 'string') throw new Error('no address');
  port = address.port;
}

function send(question: string) {
  return new Promise<{
    status: number;
    modelCalls: string | undefined;
    body: Record<string, unknown>;
  }>((resolve, reject) => {
    const req = request(
      {
        host: '127.0.0.1',
        port,
        path: '/api/ask',
        method: 'POST',
        headers: {
          Host: '127.0.0.1:4511',
          Origin: ORIGIN,
          'Content-Type': 'application/json',
        },
      },
      (response) => {
        let text = '';
        response.setEncoding('utf8').on('data', (chunk) => (text += chunk));
        response.on('end', () =>
          resolve({
            status: response.statusCode ?? 0,
            modelCalls: response.headers[HEADER] as string | undefined,
            body: JSON.parse(text),
          }),
        );
      },
    ).on('error', reject);
    req.end(ask(question));
  });
}

afterEach(async () => {
  vi.restoreAllMocks();
  if (gateway)
    await new Promise<void>((resolve) => gateway!.close(() => resolve()));
  gateway = undefined;
});

/** Moves the quota clock a minute forward after every four retrievals. */
function steppedClock() {
  let now = Date.now();
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  let sent = 0;
  return () => {
    if (sent++ % RETRIEVALS_PER_MINUTE === 0) now += MINUTE_MS;
  };
}

describe('model-call count', () => {
  it('reports one call for a request that reaches the selector', async () => {
    const select = vi.fn(async () => ({ status: 'answer', slots: [1] }));
    await open({ select });
    const result = await send(modelQuestion);
    expect(result.status).toBe(200);
    expect(result.modelCalls).toBe('1');
  });

  it('reports zero for an abstention that has no evidence for the model', async () => {
    const select = vi.fn(async () => ({ status: 'unknown', slots: [] }));
    await open({ select });
    const result = await send(abstention);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ mode: 'local', status: 'unknown' });
    expect(result.modelCalls).toBe('0');
  });

  it('reports zero for a reviewed answer served without the model', async () => {
    const select = vi.fn();
    await open({ select, local: false });
    const result = await send(modelQuestion);
    expect(result.status).toBe(200);
    expect(result.modelCalls).toBe('0');
    expect(select).not.toHaveBeenCalled();
  });

  it('counts the ranker and the selector separately', async () => {
    const ids = ['bachelor-methods', 'bachelor-contribution'];
    const rank = vi.fn(async () => ({ corpusVersion, ids }));
    const select = vi.fn(async () => ({ status: 'answer', slots: [1] }));
    await open({ rank, select });
    const result = await send(rankedQuestion);
    expect(result.status).toBe(200);
    expect(rank).toHaveBeenCalledOnce();
    expect(result.modelCalls).toBe('2');
  });

  it('keeps the count on a failed model request', async () => {
    const select = vi.fn(async () => {
      throw new Error('upstream down');
    });
    await open({ select });
    const result = await send(modelQuestion);
    expect(result.status).toBe(503);
    expect(result.modelCalls).toBe('1');
  });
});

describe('inference quota', () => {
  it('is not spent by abstentions that make no model call', async () => {
    const tick = steppedClock();
    const select = vi.fn(
      async (_q: string, _l: string, candidates: unknown[]) =>
        candidates.length
          ? { status: 'answer', slots: [1] }
          : { status: 'unknown', slots: [] },
    );
    await open({ select });
    for (let i = 0; i < INFERENCE_LIMIT + 1; i++) {
      tick();
      const result = await send(abstention);
      expect(result).toMatchObject({ status: 200, modelCalls: '0' });
    }
    tick();
    const real = await send(modelQuestion);
    expect(real).toMatchObject({ status: 200, modelCalls: '1' });
  });

  it('is spent by model calls and still lets cheap abstentions through', async () => {
    const tick = steppedClock();
    const select = vi.fn(
      async (_q: string, _l: string, candidates: unknown[]) =>
        candidates.length
          ? { status: 'answer', slots: [1] }
          : { status: 'unknown', slots: [] },
    );
    await open({ select });
    for (let i = 0; i < INFERENCE_LIMIT; i++) {
      tick();
      expect((await send(modelQuestion)).status).toBe(200);
    }
    tick();
    const calls = select.mock.calls.length;
    const limited = await send(modelQuestion);
    expect(limited.status).toBe(429);
    expect(limited.modelCalls).toBe('0');
    expect(select).toHaveBeenCalledTimes(calls);
    tick();
    expect(await send(abstention)).toMatchObject({
      status: 200,
      modelCalls: '0',
      body: { status: 'unknown', mode: 'local' },
    });
  });

  it('charges one inference per request even when it ranks and selects', async () => {
    const tick = steppedClock();
    const ids = ['bachelor-methods', 'bachelor-contribution'];
    const rank = vi.fn(async () => ({ corpusVersion, ids }));
    const select = vi.fn(async () => ({ status: 'answer', slots: [1] }));
    await open({ rank, select });
    for (let i = 0; i < INFERENCE_LIMIT; i++) {
      tick();
      expect((await send(rankedQuestion)).status).toBe(200);
    }
    tick();
    expect((await send(rankedQuestion)).status).toBe(429);
  });
});
