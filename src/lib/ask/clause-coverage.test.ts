import { describe, expect, it, vi } from 'vitest';
import { askModel, type SelectFacts } from '../../../services/ask/selection.ts';
import type { Locale } from '../../i18n';
import { facts } from './catalog';
import type { ChatTurn } from './history';

const SELECTOR_TIMEOUT_MS = 1_000;
const fact = (id: string) => facts.find((entry) => entry.id === id)!;

/** Asks with fixed candidates while the selector picks the given ids. */
async function ask(
  question: string,
  locale: Locale,
  candidateIds: readonly string[],
  pickedIds: readonly string[],
  status: 'answer' | 'partial' | 'unknown' = 'answer',
  { history }: { history?: readonly ChatTurn[] } = {},
) {
  const candidates = candidateIds.map(fact);
  const select = vi.fn<SelectFacts>(async () => ({
    status,
    slots: pickedIds.map((id) => candidateIds.indexOf(id) + 1),
  }));
  return askModel(
    select,
    question,
    locale,
    candidates,
    AbortSignal.timeout(SELECTOR_TIMEOUT_MS),
    history,
  );
}

const TUTORING = 'tutoring';
const tutoringTurn: ChatTurn = {
  question: 'Did Timo tutor programming beginners?',
  answer: fact(TUTORING).answer.en,
};

const ABACUS = ['abacus-workflow', 'abacus-missing-data', 'abacus-jenkins'];
const PORTFOLIO = 'portfolio-website-architecture';
const HTL = 'htl-dornbirn-class-website';
const ids = (result: Awaited<ReturnType<typeof ask>>) =>
  result?.claims.map(({ id }) => id);

describe('coverage of questions with several parts', () => {
  it.each([
    [
      'Which data could his Abacus workflow fill in when it is missing, and which CI server was he responsible for?',
      'en',
    ],
    [
      'Was ergänzt sein Abacus-Workflow, wenn etwas fehlt, und welches CI-System betreute er?',
      'de',
    ],
  ] as const)(
    'keeps one selected fact per supported part: %s',
    async (question, locale) => {
      const result = await ask(question, locale, ABACUS, [
        'abacus-missing-data',
        'abacus-jenkins',
      ]);
      expect(result?.status).toBe('answer');
      expect(ids(result)).toEqual(['abacus-missing-data', 'abacus-jenkins']);
    },
  );

  it.each([
    [
      'Which framework and which programming language did Timo use for this portfolio?',
      'en',
    ],
    [
      'Welches Framework und welche Programmiersprache nutzt dieses Portfolio?',
      'de',
    ],
  ] as const)(
    'lets one fact cover several parts: %s',
    async (question, locale) => {
      const result = await ask(question, locale, [PORTFOLIO], [PORTFOLIO]);
      expect(result?.status).toBe('answer');
      expect(ids(result)).toEqual([PORTFOLIO]);
    },
  );

  it.each([
    [
      'What could classmates do on his HTL website, and which web framework powered it?',
      'en',
    ],
    [
      'Was konnte die Klasse auf seiner HTL-Website machen, und welches Framework steckte dahinter?',
      'de',
    ],
  ] as const)(
    'keeps the supported part and marks the rest missing: %s',
    async (question, locale) => {
      const result = await ask(question, locale, [HTL], [HTL]);
      expect(result?.status).toBe('partial');
      expect(result?.missing).toBe('additional-question');
      expect(ids(result)).toEqual([HTL]);
    },
  );

  it.each([
    [
      'Which CI server did he use at Abacus, and which Abacus office did he work in?',
      'en',
    ],
    [
      'Welchen CI-Server betreute er bei Abacus, und welches Abacus-Büro war seins?',
      'de',
    ],
  ] as const)(
    'does not let an on-topic fact fill a second part: %s',
    async (question, locale) => {
      const result = await ask(
        question,
        locale,
        ['abacus-jenkins'],
        ['abacus-jenkins'],
      );
      expect(result?.status).toBe('partial');
      expect(result?.missing).toBe('additional-question');
      expect(ids(result)).toEqual(['abacus-jenkins']);
    },
  );

  it.each([
    ['Where did Timo tutor beginners, and when was that?', 'en'],
    ['Wo war Timo Tutor für Anfänger, und wann war das?', 'de'],
  ] as const)(
    'lets one fact that states both details cover both parts: %s',
    async (question, locale) => {
      const result = await ask(question, locale, [TUTORING], [TUTORING]);
      expect(result?.status).toBe('answer');
      expect(ids(result)).toEqual([TUTORING]);
    },
  );

  it.each([
    [
      'Where did Timo tutor beginners, and which CI server was he responsible for at Abacus?',
      'en',
    ],
    [
      'Wo war Timo Tutor für Anfänger, und welchen CI-Server betreute er bei Abacus?',
      'de',
    ],
  ] as const)(
    'lets two facts cover two parts: %s',
    async (question, locale) => {
      const result = await ask(
        question,
        locale,
        [TUTORING, 'abacus-jenkins'],
        [TUTORING, 'abacus-jenkins'],
      );
      expect(result?.status).toBe('answer');
      expect(ids(result)).toEqual([TUTORING, 'abacus-jenkins']);
    },
  );

  it.each([
    [
      'Where did Timo tutor beginners, and when did he take responsibility for Jenkins at Abacus?',
      'en',
    ],
    [
      'Wo war Timo Tutor für Anfänger, und wann übernahm er bei Abacus die Verantwortung für Jenkins?',
      'de',
    ],
  ] as const)(
    'does not let one topic’s date answer another topic’s part: %s',
    async (question, locale) => {
      const onlyTutoring = await ask(question, locale, [TUTORING], [TUTORING]);
      expect(onlyTutoring?.status).toBe('partial');
      expect(onlyTutoring?.missing).toBe('additional-question');
      expect(ids(onlyTutoring)).toEqual([TUTORING]);
      // The Jenkins fact names the event but records no date for it.
      const both = await ask(
        question,
        locale,
        [TUTORING, 'abacus-jenkins'],
        [TUTORING, 'abacus-jenkins'],
      );
      expect(both?.status).toBe('partial');
      expect(both?.missing).toBe('additional-question');
    },
  );

  it.each([
    ['When and where did Timo tutor beginners?', 'en'],
    ['Wann und wo war Timo Tutor für Anfänger?', 'de'],
  ] as const)(
    'gives a bare question word the subject of the part it opens: %s',
    async (question, locale) => {
      const result = await ask(question, locale, [TUTORING], [TUTORING]);
      expect(result?.status).toBe('answer');
      expect(ids(result)).toEqual([TUTORING]);
    },
  );

  it.each([
    [
      'Where did Timo tutor beginners, and which programming language did he teach?',
      'en',
    ],
    [
      'Wo war Timo Tutor für Anfänger, und welche Programmiersprache unterrichtete er?',
      'de',
    ],
  ] as const)(
    'marks only the unstated part missing: %s',
    async (question, locale) => {
      const result = await ask(question, locale, [TUTORING], [TUTORING]);
      expect(result?.status).toBe('partial');
      expect(result?.missing).toBe('additional-question');
      expect(ids(result)).toEqual([TUTORING]);
    },
  );

  it.each([
    ['Where and when was that?', 'en'],
    ['Wo und wann war das?', 'de'],
  ] as const)(
    'carries the previous turn’s subject into a follow-up: %s',
    async (question, locale) => {
      const result = await ask(
        question,
        locale,
        [TUTORING],
        [TUTORING],
        'answer',
        {
          history: [tutoringTurn],
        },
      );
      expect(result?.status).toBe('answer');
      expect(ids(result)).toEqual([TUTORING]);
    },
  );

  it.each([
    ['Where and when was that?', 'en'],
    ['Wo und wann war das?', 'de'],
  ] as const)(
    'does not invent a subject without history: %s',
    async (question, locale) => {
      const result = await ask(question, locale, [TUTORING], [TUTORING]);
      expect(result?.status).toBe('unknown');
    },
  );

  it.each([
    ['New topic: where and when was that?', 'en'],
    ['Anderes Thema: wo und wann war das?', 'de'],
  ] as const)(
    'drops the previous subject after a subject change: %s',
    async (question, locale) => {
      const result = await ask(
        question,
        locale,
        [TUTORING],
        [TUTORING],
        'answer',
        {
          history: [tutoringTurn],
        },
      );
      expect(result?.status).toBe('unknown');
    },
  );

  it.each([
    [
      'What could classmates do on his HTL website, and which web framework powered it?',
      'en',
    ],
    [
      'Was konnte die Klasse auf seiner HTL-Website machen, und welches Framework steckte dahinter?',
      'de',
    ],
  ] as const)(
    'abstains when no part is supported: %s',
    async (question, locale) => {
      const result = await ask(question, locale, [HTL], [], 'unknown');
      expect(result?.status).toBe('unknown');
      expect(ids(result)).toEqual([]);
    },
  );

  it.each([
    [
      'What could classmates do on his HTL website, and which web framework powered it?',
      'en',
    ],
    [
      'Was konnte die Klasse auf seiner HTL-Website machen, und welches Framework steckte dahinter?',
      'de',
    ],
  ] as const)(
    'drops a selected fact that matches no part: %s',
    async (question, locale) => {
      const result = await ask(
        question,
        locale,
        [HTL, 'spotify-python'],
        ['spotify-python'],
      );
      expect(result?.status).toBe('unknown');
      expect(ids(result)).toEqual([]);
    },
  );
});
