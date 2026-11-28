import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_OLLAMA_THREADS,
  MODEL,
  MODEL_DIGEST,
  ollamaThreads,
  selectWithOllama,
} from '../../../services/ask/ollama.ts';
import { facts } from './catalog';

describe('Ollama thread count', () => {
  it('defaults to four threads', () => {
    expect(DEFAULT_OLLAMA_THREADS).toBe(4);
    expect(ollamaThreads({})).toBe(DEFAULT_OLLAMA_THREADS);
  });

  it.each([
    ['1', 1],
    ['6', 6],
    ['16', 16],
  ])('uses ASK_OLLAMA_THREADS=%s', (value, expected) => {
    expect(ollamaThreads({ ASK_OLLAMA_THREADS: value })).toBe(expected);
  });

  it.each(['0', '-2', '2.5', 'four', '', '1000'])(
    'falls back to the default for %j',
    (value) => {
      expect(ollamaThreads({ ASK_OLLAMA_THREADS: value })).toBe(
        DEFAULT_OLLAMA_THREADS,
      );
    },
  );
});

describe('selector request', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('asks Ollama for the configured thread count', async () => {
    vi.stubEnv('ASK_OLLAMA_THREADS', '6');
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async (input, init) => {
        if (String(input).endsWith('/api/tags'))
          return Response.json({
            models: [{ name: MODEL, digest: MODEL_DIGEST }],
          });
        bodies.push(JSON.parse(String(init?.body)));
        return Response.json({
          message: {
            content: JSON.stringify({ slots: [], incomplete: false }),
          },
        });
      }),
    );
    await selectWithOllama(
      'Which project used Flask?',
      'en',
      facts.filter(({ id }) => id === 'spotify-python'),
      AbortSignal.timeout(1_000),
    ).catch(() => undefined);
    expect(bodies[0]?.options).toMatchObject({ num_thread: 6 });
  });
});
