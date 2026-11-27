import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_CLAIMS } from './catalog';
import {
  MODEL,
  MODEL_DIGEST,
  selectWithOllama,
  setOllamaCallListener,
} from '../../../services/ask/ollama.ts';
import { facts } from './catalog';

type Message = { role: string; content: string };
type Request = {
  messages: Message[];
  format: { required: string[]; properties: Record<string, object> };
};

/** Stubs Ollama with one selector reply and records the chat requests. */
function stubSelector(reply: object) {
  const requests: Request[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (input, init) => {
      if (String(input).endsWith('/api/tags'))
        return Response.json({
          models: [{ name: MODEL, digest: MODEL_DIGEST }],
        });
      requests.push(JSON.parse(String(init?.body)));
      return Response.json({
        done: true,
        done_reason: 'stop',
        message: { content: JSON.stringify(reply) },
        total_duration: 1_500_000_000,
        load_duration: 2_000_000,
        prompt_eval_duration: 400_000_000,
        eval_duration: 1_000_000_000,
        prompt_eval_count: 120,
        eval_count: 11,
      });
    }),
  );
  return requests;
}

const candidates = facts.filter(({ id }) =>
  ['spotify-python', 'spotify-rewrite'].includes(id),
);
const ask = (clarifyAbout?: string) =>
  selectWithOllama(
    'Which project used Flask?',
    'en',
    candidates,
    AbortSignal.timeout(1_000),
    undefined,
    clarifyAbout,
  );

describe('Ollama selector', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setOllamaCallListener(undefined);
  });

  it('reports each model call with its raw reply and timings', async () => {
    const reply = { slots: [1], incomplete: false };
    stubSelector(reply);
    const listener = vi.fn();
    setOllamaCallListener(listener);
    await ask();
    expect(listener).toHaveBeenCalledExactlyOnceWith({
      model: MODEL,
      reply: JSON.stringify(reply),
      totalMs: 1500,
      loadMs: 2,
      promptMs: 400,
      generationMs: 1000,
      promptTokens: 120,
      outputTokens: 11,
    });
  });

  it('abstains without a model call when there is no evidence', async () => {
    const requests = stubSelector({ slots: [], incomplete: false });
    const result = await selectWithOllama(
      'Wie viel verdient Timo?',
      'de',
      [],
      AbortSignal.timeout(1_000),
    );
    expect(result).toEqual({ slots: [], status: 'unknown' });
    expect(requests).toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('stops reporting once the listener is removed', async () => {
    stubSelector({ slots: [1], incomplete: false });
    const listener = vi.fn();
    setOllamaCallListener(listener);
    setOllamaCallListener(undefined);
    await ask();
    expect(listener).not.toHaveBeenCalled();
  });

  it('asks for at most three evidence slot numbers', async () => {
    const requests = stubSelector({ slots: [1], incomplete: false });
    await ask();
    const { format } = requests[0];
    expect(format.required).toEqual(['slots', 'incomplete']);
    expect(format.properties.slots).toMatchObject({
      maxItems: MAX_CLAIMS,
      items: { type: 'integer', enum: [1, 2] },
    });
  });

  it.each([
    [[2], false, { slots: [2], status: 'answer' }],
    [[2, 1], true, { slots: [2, 1], status: 'partial' }],
    [[1, 1], false, { slots: [1], status: 'answer' }],
    [[], false, { slots: [], status: 'unknown' }],
  ])(
    'turns slots %j with incomplete=%s into a selection',
    async (slots, incomplete, expected) => {
      stubSelector({ slots, incomplete });
      expect(await ask()).toEqual(expected);
    },
  );

  it.each([
    ['relevance flags', { relevant: [true, false], incomplete: false }],
    ['a clarification slot', { slots: [0], incomplete: false }],
    ['no incomplete flag', { slots: [1], other: false }],
    ['a non-array selection', { slots: 1, incomplete: false }],
  ])('rejects a reply with %s', async (_, reply) => {
    stubSelector(reply);
    expect(await ask()).toBeNull();
  });

  it('sends worked examples between the rules and the question', async () => {
    const requests = stubSelector({
      slots: [],
      incomplete: false,
    });
    await ask();
    const { messages } = requests[0];
    expect(messages[0].role).toBe('system');
    expect(messages.at(-1)).toMatchObject({ role: 'user' });
    expect(JSON.parse(messages.at(-1)!.content).question).toBe(
      'Which project used Flask?',
    );
    const examples = messages.slice(1, -1);
    expect(examples.length).toBeGreaterThan(0);
    expect(examples.map(({ role }) => role)).toEqual(
      examples.map((_, index) => (index % 2 ? 'assistant' : 'user')),
    );
    // Examples are about an invented person, never reviewed portfolio facts.
    const text = examples.map(({ content }) => content).join(' ');
    expect(text).not.toMatch(/Timo/);
    expect(facts.some(({ answer }) => text.includes(answer.en))).toBe(false);
  });

  it('puts the question after history and evidence in every request', async () => {
    const requests = stubSelector({ slots: [], incomplete: false });
    await selectWithOllama(
      'Which project used Flask?',
      'en',
      candidates,
      AbortSignal.timeout(1_000),
      [{ question: 'What is SpotifyTracker?', answer: 'A listening tracker.' }],
    );
    const users = requests[0].messages.filter(({ role }) => role === 'user');
    for (const { content } of users)
      expect(Object.keys(JSON.parse(content)).at(-1)).toBe('question');
    expect(Object.keys(JSON.parse(users.at(-1)!.content))).toEqual([
      'history',
      'evidence',
      'question',
    ]);
  });

  it('shows a two-part question answered by one slot per part', async () => {
    const requests = stubSelector({ slots: [], incomplete: false });
    await ask();
    const replies = requests[0].messages
      .filter(({ role }) => role === 'assistant')
      .map(({ content }) => JSON.parse(content) as { slots: number[] });
    expect(replies.some(({ slots }) => slots.length > 1)).toBe(true);
  });

  it('gives each example only slots its evidence offers', async () => {
    const requests = stubSelector({ slots: [], incomplete: false });
    await ask();
    const { messages } = requests[0];
    for (let index = 1; index < messages.length - 1; index += 2) {
      const { evidence } = JSON.parse(messages[index].content);
      const { slots } = JSON.parse(messages[index + 1].content);
      const offered = evidence.map(({ slot }: { slot: number }) => slot);
      expect(slots.length).toBeLessThanOrEqual(MAX_CLAIMS);
      for (const slot of slots) expect(offered).toContain(slot);
    }
  });

  it('covers answering, partial and abstaining in the examples', async () => {
    const requests = stubSelector({ slots: [], incomplete: false });
    await ask();
    const { messages } = requests[0];
    const examples = messages.slice(1, -1).flatMap((message, index, all) =>
      index % 2
        ? []
        : [
            {
              offered: JSON.parse(message.content).evidence.length as number,
              ...(JSON.parse(all[index + 1].content) as {
                slots: number[];
                incomplete: boolean;
              }),
            },
          ],
    );
    expect(
      examples.some(({ slots, incomplete }) => !slots.length && !incomplete),
    ).toBe(true);
    expect(
      examples.some(({ slots, incomplete }) => slots.length && incomplete),
    ).toBe(true);
    expect(
      examples.some(({ slots, incomplete }) => slots.length && !incomplete),
    ).toBe(true);
    // At least one example leaves out a fact about the same project.
    expect(
      examples.some(
        ({ slots, offered }) => slots.length && slots.length < offered,
      ),
    ).toBe(true);
  });

  it('leaves the examples out of a project-scope clarification', async () => {
    const requests = stubSelector({ slots: [0], incomplete: false });
    expect(await ask('SpotifyTracker')).toEqual({
      status: 'clarify',
      slots: [],
    });
    expect(requests[0].messages.map(({ role }) => role)).toEqual([
      'system',
      'user',
    ]);
    expect(requests[0].format.required).toEqual(['slots', 'incomplete']);
  });

  it('collapses a repeated clarification slot', async () => {
    stubSelector({ slots: [0, 0], incomplete: false });
    expect(await ask('SpotifyTracker')).toEqual({
      status: 'clarify',
      slots: [],
    });
  });

  it('keeps distinct clarification-mode slots in order', async () => {
    stubSelector({ slots: [2, 1, 2], incomplete: true });
    expect(await ask('SpotifyTracker')).toEqual({
      slots: [2, 1],
      status: 'partial',
    });
  });
});
