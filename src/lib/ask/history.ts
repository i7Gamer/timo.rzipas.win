import { normalize } from './catalog.ts';

export const MAX_HISTORY_BYTES = 2_000;
const RECENT_TURNS = 2;
const EXCERPT_LENGTH = 240;
const encoder = new TextEncoder();
const filler = new Set(
  'about again called earlier first for from how its machine mention mentioned one tell that the their this timo use used was what when where which who with you your das dem den der dessen die ein fuer hast hiess ich ist mit neben noch nochmal rechner sagt sagte timo ueber und vorher vorhin war was welche welcher wie zum zur'.split(
    ' ',
  ),
);

export interface ChatTurn {
  question: string;
  answer: string;
}

interface TaggedTurn extends ChatTurn {
  subjects?: readonly { label: string }[];
  evidence?: readonly string[];
}

function terms(text: string) {
  return new Set(
    normalize(text)
      .split(' ')
      .filter((word) => word.length >= 3 && !filler.has(word)),
  );
}

function overlap(query: ReadonlySet<string>, text: string) {
  const words = terms(text);
  return [...query].filter((word) => words.has(word)).length;
}

export function findEarlierTurn<T extends TaggedTurn>(
  turns: readonly T[],
  cue: string,
) {
  const query = terms(cue);
  if (!query.size) return undefined;
  return turns.findLast(
    ({ question, answer, subjects, evidence }) =>
      overlap(
        query,
        [
          question,
          answer,
          ...(evidence ?? []),
          ...(subjects?.map(({ label }) => label) ?? []),
        ].join(' '),
      ) === query.size,
  );
}

function excerpt(text: string, query: ReadonlySet<string>) {
  if ([...text].length <= EXCERPT_LENGTH) return text;
  const sentences = text.split(/(?<=[.!?])\s+/);
  const relevant = sentences.reduce(
    (best, sentence) =>
      overlap(query, sentence) > overlap(query, best) ? sentence : best,
    '',
  );
  return [...(relevant || text)].slice(0, EXCERPT_LENGTH).join('');
}

function bytes(value: unknown) {
  return encoder.encode(JSON.stringify(value)).length;
}

export function selectChatHistory(turns: ChatTurn[], question: string) {
  if (bytes(turns) <= MAX_HISTORY_BYTES) return turns;
  const query = terms(question);
  const priority = turns
    .map((turn, index) => ({
      turn,
      index,
      recent: index >= turns.length - RECENT_TURNS,
      score: overlap(query, turn.question + ' ' + turn.answer),
    }))
    .sort(
      (a, b) =>
        Number(b.recent) - Number(a.recent) ||
        (a.recent ? 0 : b.score - a.score) ||
        b.index - a.index,
    );
  const selected = new Map<number, ChatTurn>();
  let size = bytes([]);
  for (const { turn, index } of priority) {
    const available = MAX_HISTORY_BYTES - size - Number(selected.size > 0);
    const entry = {
      question: excerpt(turn.question, query),
      answer: excerpt(turn.answer, query),
    };
    const length = bytes(entry);
    if (length <= available) {
      size = MAX_HISTORY_BYTES - available + length;
      selected.set(index, entry);
    }
  }
  return [...selected].sort(([a], [b]) => a - b).map(([, turn]) => turn);
}

export function recallChat<T extends TaggedTurn>(question: string, turns: T[]) {
  const text = normalize(question);
  if (
    /^(?:what did i ask first|what was my first question|what did we start with|was habe ich zuerst gefragt|was war meine erste frage)$/.test(
      text,
    )
  )
    return { field: 'question', turn: turns[0] } as const;
  if (
    /^(?:what (?:was|did i ask in) my (?:last|previous) question|what did i (?:just|last) ask|was habe ich (?:gerade|zuletzt) gefragt|was war meine letzte frage)$/.test(
      text,
    )
  )
    return { field: 'question', turn: turns.at(-1) } as const;
  if (
    /^(?:what was your first (?:answer|reply)|what did you say first|was war deine erste antwort)$/.test(
      text,
    )
  )
    return { field: 'answer', turn: turns[0] } as const;
  if (
    /^(?:what was your (?:last|previous) (?:answer|reply)|what did you just say|was war deine letzte antwort|was hast du gerade gesagt)$/.test(
      text,
    )
  )
    return { field: 'answer', turn: turns.at(-1) } as const;
  const earlierProject =
    /^(?:which|what) (?:project|machine) did (?:i ask|we talk) about (?:earlier|before)(?: and (.+))?$/.exec(
      text,
    );
  if (earlierProject)
    return {
      field: 'answer',
      turn: earlierProject[1]
        ? findEarlierTurn(turns, earlierProject[1])
        : turns.findLast(({ subjects }) => subjects?.length),
    } as const;
  const cue =
    /^(?:what did you (?:say|tell me)(?: earlier)? about|repeat what you said about) (.+?)(?: earlier| before)?$/.exec(
      text,
    )?.[1] ??
    /^(?:was hast du (?:(?:vorhin|vorher) )?ueber|wiederhole was du ueber) (.+?) (?:gesagt|erzaehlt)(?: hast)?$/.exec(
      text,
    )?.[1];
  return cue
    ? ({ field: 'answer', turn: findEarlierTurn(turns, cue) } as const)
    : null;
}

export function isChatHistory(value: unknown): value is ChatTurn[] {
  return (
    Array.isArray(value) &&
    bytes(value) <= MAX_HISTORY_BYTES &&
    value.every((entry: unknown) => {
      if (
        !entry ||
        typeof entry !== 'object' ||
        Object.keys(entry).length !== 2
      )
        return false;
      const { question, answer } = entry as Partial<ChatTurn>;
      return [question, answer].every(
        (text) =>
          typeof text === 'string' &&
          text.trim().length > 0 &&
          text.isWellFormed(),
      );
    })
  );
}
