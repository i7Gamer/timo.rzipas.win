import { describe, expect, it, vi } from 'vitest';
import { askModel, type SelectFacts } from '../../../services/ask/selection.ts';
import type { Locale } from '../../i18n';
import { facts } from './catalog';

const SELECTOR_TIMEOUT_MS = 1_000;
const fact = (id: string) => facts.find((entry) => entry.id === id)!;

/** Asks with fixed candidates while the selector picks the given ids. */
async function ask(
  question: string,
  locale: Locale,
  candidateIds: readonly string[],
  pickedIds: readonly string[],
  status: 'answer' | 'partial' | 'unknown' = 'answer',
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
  );
}

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
