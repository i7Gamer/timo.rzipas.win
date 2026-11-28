import { describe, expect, it } from 'vitest';
import heldOut from '../../../tests/ask/held-out.json';
import paraphrases from '../../../tests/ask/paraphrases.json';
import questions from '../../../tests/ask/questions.json';
import {
  BASELINES,
  contentHash,
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

describe('run identity', () => {
  const evaluated = [
    {
      suite: 'original',
      locale: 'en',
      question: 'Q?',
      status: 'answer',
      acceptableIds: [['a']],
    },
  ];

  it('records hashes of the fixtures and of the evaluated expectations', () => {
    const identity = runIdentity({
      version: 'baseline-v2',
      files: currentFiles,
      evaluated,
    });
    expect(identity.version).toBe('baseline-v2');
    expect(identity.fixtureHashes).toEqual(fixtureHashes(currentFiles));
    expect(identity.expectationHash).toBe(contentHash(evaluated));
    expect(identity.matchesPin).toBe(true);
    expect(identity.baselines).toBe(BASELINES);
  });

  it('flags fixtures that no longer match the pinned baseline', () => {
    const identity = runIdentity({
      version: 'baseline-v2',
      files: { ...currentFiles, questions: [] },
      evaluated,
    });
    expect(identity.matchesPin).toBe(false);
  });

  it('has no pin to compare for the approved overlay', () => {
    const identity = runIdentity({
      version: 'approved-v2',
      files: currentFiles,
      evaluated,
    });
    expect(identity.matchesPin).toBeNull();
  });

  it('changes the expectation hash when one expectation changes', () => {
    const changed = [{ ...evaluated[0], status: 'partial' }];
    expect(
      runIdentity({ version: 'approved-v2', files: currentFiles, evaluated })
        .expectationHash,
    ).not.toBe(
      runIdentity({
        version: 'approved-v2',
        files: currentFiles,
        evaluated: changed,
      }).expectationHash,
    );
  });
});
