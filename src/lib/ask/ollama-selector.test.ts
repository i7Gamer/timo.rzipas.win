import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MODEL,
  MODEL_DIGEST,
  selectWithOllama,
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
  afterEach(() => vi.unstubAllGlobals());

  it('asks for one relevance flag per evidence slot', async () => {
    const requests = stubSelector({
      relevant: [true, false],
      incomplete: false,
    });
    await ask();
    const { format } = requests[0];
    expect(format.required).toEqual(['relevant', 'incomplete']);
    expect(format.properties.relevant).toMatchObject({
      minItems: candidates.length,
      maxItems: candidates.length,
      items: { type: 'boolean' },
    });
  });

  it.each([
    [[false, true], false, { slots: [2], status: 'answer' }],
    [[true, true], true, { slots: [1, 2], status: 'partial' }],
    [[false, false], false, { slots: [], status: 'unknown' }],
  ])(
    'turns flags %j with incomplete=%s into a selection',
    async (relevant, incomplete, expected) => {
      stubSelector({ relevant, incomplete });
      expect(await ask()).toEqual(expected);
    },
  );

  it.each([
    ['too few flags', { relevant: [true], incomplete: false }],
    ['a non-boolean flag', { relevant: [true, 1], incomplete: false }],
    ['slot numbers', { slots: [1], incomplete: false }],
    ['no incomplete flag', { relevant: [true, false], other: false }],
  ])('rejects a reply with %s', async (_, reply) => {
    stubSelector(reply);
    expect(await ask()).toBeNull();
  });

  it('sends worked examples between the rules and the question', async () => {
    const requests = stubSelector({
      relevant: [false, false],
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

  it('gives each example one flag per evidence item', async () => {
    const requests = stubSelector({
      relevant: [false, false],
      incomplete: false,
    });
    await ask();
    const { messages } = requests[0];
    for (let index = 1; index < messages.length - 1; index += 2) {
      const { evidence } = JSON.parse(messages[index].content);
      const { relevant } = JSON.parse(messages[index + 1].content);
      expect(relevant).toHaveLength(evidence.length);
    }
  });

  it('covers answering, partial and abstaining in the examples', async () => {
    const requests = stubSelector({
      relevant: [false, false],
      incomplete: false,
    });
    await ask();
    const replies: { relevant: boolean[]; incomplete: boolean }[] =
      requests[0].messages
        .filter(({ role }) => role === 'assistant')
        .map(({ content }) => JSON.parse(content));
    const chosen = (flags: boolean[]) => flags.some(Boolean);
    expect(
      replies.some(
        ({ relevant, incomplete }) => !chosen(relevant) && !incomplete,
      ),
    ).toBe(true);
    expect(
      replies.some(
        ({ relevant, incomplete }) => chosen(relevant) && incomplete,
      ),
    ).toBe(true);
    expect(
      replies.some(
        ({ relevant, incomplete }) => chosen(relevant) && !incomplete,
      ),
    ).toBe(true);
    // At least one example rejects a fact about the same project.
    expect(
      replies.some(
        ({ relevant }) => chosen(relevant) && !relevant.every(Boolean),
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
