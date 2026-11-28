import { describe, expect, it } from 'vitest';
import heldOut from '../../../tests/ask/held-out.json';
import paraphrases from '../../../tests/ask/paraphrases.json';
import questions from '../../../tests/ask/questions.json';
import {
  BASELINES,
  builtInFixtures,
  contentHash,
  evaluatedRow,
  expectationsLabel,
  fixtureHashes,
  runIdentity,
} from '../../../tests/ask/identity.ts';

const currentFiles = { questions, paraphrases, heldOut };

describe('content hash', () => {
  it('is stable for equal content and ignores key order and whitespace', () => {
    expect(contentHash({ a: 1, b: [2] })).toBe(contentHash({ b: [2], a: 1 }));
    expect(contentHash([1, 2])).toBe(contentHash(JSON.parse('[ 1,\n2 ]')));
  });

  it('changes when the content changes', () => {
    expect(contentHash([1, 2])).not.toBe(contentHash([2, 1]));
    expect(contentHash({ status: 'answer' })).not.toBe(
      contentHash({ status: 'partial' }),
    );
  });
});

describe('baseline labels', () => {
  it('labels the corrected fixtures baseline-v2 and the overlay approved-v2', () => {
    expect(expectationsLabel(true)).toBe('baseline-v2');
    expect(expectationsLabel(false)).toBe('approved-v2');
  });
});

describe('baseline pins', () => {
  it('pins the current raw fixtures to baseline-v2', () => {
    expect(fixtureHashes(currentFiles)).toEqual(
      BASELINES['baseline-v2'].fixtures,
    );
  });

  it('pins baseline-v1 to the historical commit before the six corrections', () => {
    expect(BASELINES['baseline-v1'].commit).toBe('de3fe14');
    expect(BASELINES['baseline-v2'].commit).toBe('dc5e90d');
    const v1 = BASELINES['baseline-v1'].fixtures;
    const v2 = BASELINES['baseline-v2'].fixtures;
    expect(v1.questions).not.toBe(v2.questions);
    expect(v1.heldOut).not.toBe(v2.heldOut);
    expect(v1.paraphrases).toBe(v2.paraphrases);
  });
});

const fullSet = builtInFixtures(currentFiles);
const HISTORY_FACT_ID = 'spotify-python';
const OTHER_FACT_ID = 'spotify-rewrite';
const historyFixture = {
  suite: 'dev',
  id: 'dev-en-051',
  locale: 'en',
  question: 'And what about the second one?',
  status: 'answer',
  acceptableIds: [[HISTORY_FACT_ID]],
  history: [
    { question: 'Which project used Flask?', answerIds: [HISTORY_FACT_ID] },
  ],
};

describe('evaluated row', () => {
  it('normalizes the history as it is sent into Ask', () => {
    const row = evaluatedRow(historyFixture);
    expect(row.history).toEqual([
      { question: 'Which project used Flask?', answer: expect.any(String) },
    ]);
    expect(row.history[0].answer).not.toBe('');
  });

  it('defaults optional fields so absent and explicit defaults agree', () => {
    const bare = { ...historyFixture, history: undefined };
    expect(evaluatedRow(bare)).toEqual(
      evaluatedRow({
        ...bare,
        history: [],
        requiresModelCall: false,
        expectedMode: undefined,
        expectationOverlay: false,
      }),
    );
  });

  it('treats any locale other than de as en, as the evaluator does', () => {
    expect(evaluatedRow({ ...historyFixture, locale: 'fr' }).locale).toBe('en');
    expect(evaluatedRow({ ...historyFixture, locale: 'de' }).locale).toBe('de');
  });
});

describe('built-in fixtures', () => {
  it('lists the original, paraphrase and held-out rows in suite order', () => {
    const suites = [...new Set(fullSet.map(({ suite }) => suite))];
    expect(suites).toEqual(['original', 'paraphrases', 'held-out']);
    expect(fullSet).toHaveLength(
      questions.length + paraphrases.length + heldOut.length,
    );
  });
});

describe('run identity', () => {
  const evaluated = [historyFixture];
  const identityOf = (rows: readonly unknown[], version = 'approved-v2') =>
    runIdentity({ version, files: currentFiles, evaluated: rows as never });

  it('records hashes of the fixtures and of the evaluated rows', () => {
    const identity = identityOf(fullSet, 'baseline-v2');
    expect(identity.version).toBe('baseline-v2');
    expect(identity.fixtureHashes).toEqual(fixtureHashes(currentFiles));
    expect(identity.expectationHash).toBe(
      contentHash(fullSet.map((row) => evaluatedRow(row))),
    );
    expect(identity.evaluatedCount).toBe(fullSet.length);
    expect(identity.baselines).toBe(BASELINES);
  });

  it('matches the pin for the full built-in set', () => {
    expect(identityOf(fullSet, 'baseline-v2').matchesPin).toBe(true);
  });

  it('keeps the historical pins untouched', () => {
    expect(BASELINES['baseline-v1'].fixtures).toEqual({
      questions:
        '5defdd6e794524ecc8e245711cb962e8e04dd1477eed55eda8b15d374f919e94',
      paraphrases:
        '1c34ea922dc144e92d69d83dd5ae20deaa65609890f245fe92aff5f09e1f7952',
      heldOut:
        '8072acc11efc200faf299556d877cd835e4b26812925bb504622998500061a99',
    });
    expect(BASELINES['baseline-v2'].fixtures).toEqual({
      questions:
        '6e61a29022fe4d0cf664fd2316e0ae0a76ff88d9f3cffbd087969b42bf7f6e13',
      paraphrases:
        '1c34ea922dc144e92d69d83dd5ae20deaa65609890f245fe92aff5f09e1f7952',
      heldOut:
        '2d48863b5a990bf104cc1363f057ebf483ae12999e2cb1eb19616189b8c44d5a',
    });
  });

  it('does not match when the fixture files differ from the pin', () => {
    const identity = runIdentity({
      version: 'baseline-v2',
      files: { ...currentFiles, questions: [] },
      evaluated: builtInFixtures({ ...currentFiles, questions: [] }),
    });
    expect(identity.matchesPin).toBe(false);
  });

  it('does not match a baseline-v1 pin against the current files', () => {
    expect(identityOf(fullSet, 'baseline-v1').matchesPin).toBe(false);
  });

  it('does not match when a custom subset is evaluated', () => {
    expect(identityOf(fullSet.slice(1), 'baseline-v2').matchesPin).toBe(false);
    expect(identityOf([], 'baseline-v2').matchesPin).toBe(false);
  });

  it('does not match when a custom question set is evaluated', () => {
    expect(identityOf(evaluated, 'baseline-v2').matchesPin).toBe(false);
  });

  it('does not match when an evaluated row differs from the built-in one', () => {
    const changed = fullSet.map((row, index) =>
      index ? row : { ...row, requiresModelCall: true },
    );
    expect(identityOf(changed, 'baseline-v2').matchesPin).toBe(false);
  });

  it('has no pin to compare for the approved overlay', () => {
    expect(identityOf(fullSet, 'approved-v2').matchesPin).toBeNull();
  });

  it('changes the hash when one expectation changes', () => {
    const changed = [{ ...historyFixture, status: 'partial' }];
    expect(identityOf(evaluated).expectationHash).not.toBe(
      identityOf(changed).expectationHash,
    );
  });

  it('changes the hash when only a prior answer in the history changes', () => {
    const changed = [
      {
        ...historyFixture,
        history: [{ ...historyFixture.history[0], answerIds: [OTHER_FACT_ID] }],
      },
    ];
    expect(identityOf(changed).expectationHash).not.toBe(
      identityOf(evaluated).expectationHash,
    );
  });

  it('changes the hash when only requiresModelCall changes', () => {
    const changed = [{ ...historyFixture, requiresModelCall: true }];
    expect(identityOf(changed).expectationHash).not.toBe(
      identityOf(evaluated).expectationHash,
    );
  });

  it('changes the hash when expectedMode or the overlay flag changes', () => {
    const base = identityOf(evaluated).expectationHash;
    expect(
      identityOf([{ ...historyFixture, expectedMode: 'local' }])
        .expectationHash,
    ).not.toBe(base);
    expect(
      identityOf([{ ...historyFixture, expectationOverlay: true }])
        .expectationHash,
    ).not.toBe(base);
  });

  it('ignores JSON whitespace and key order', () => {
    const reformatted =
      JSON.parse(`{ "history":[{"answerIds":["${HISTORY_FACT_ID}"],
      "question":"Which project used Flask?"}],
      "acceptableIds":[["${HISTORY_FACT_ID}"]], "status":"answer",
      "question":"And what about the second one?", "locale":"en",
      "id":"dev-en-051", "suite":"dev" }`);
    expect(identityOf([reformatted]).expectationHash).toBe(
      identityOf(evaluated).expectationHash,
    );
  });
});
