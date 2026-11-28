// Identity of the benchmark inputs, recorded in every evaluator report so a
// comparison can tell which fixtures and expectations it used.
import { createHash } from 'node:crypto';
import { type HistoryEntry, historyTurns } from './question-set.ts';

export const CURRENT_BASELINE = 'baseline-v2';

/**
 * Raw fixture content (hash of the parsed JSON) of each `--baseline` version.
 * Commit dc5e90d changed six expectations from partial to answer in the
 * original and held-out fixtures, so the current files are baseline-v2.
 * baseline-v1 is the content at its parent commit, de3fe14. Editing a
 * fixture file fails the pin test until it gets a new version here.
 */
export const BASELINES = {
  'baseline-v1': {
    commit: 'de3fe14',
    fixtures: {
      questions:
        '5defdd6e794524ecc8e245711cb962e8e04dd1477eed55eda8b15d374f919e94',
      paraphrases:
        '1c34ea922dc144e92d69d83dd5ae20deaa65609890f245fe92aff5f09e1f7952',
      heldOut:
        '8072acc11efc200faf299556d877cd835e4b26812925bb504622998500061a99',
    },
  },
  'baseline-v2': {
    commit: 'dc5e90d',
    fixtures: {
      questions:
        '6e61a29022fe4d0cf664fd2316e0ae0a76ff88d9f3cffbd087969b42bf7f6e13',
      paraphrases:
        '1c34ea922dc144e92d69d83dd5ae20deaa65609890f245fe92aff5f09e1f7952',
      heldOut:
        '2d48863b5a990bf104cc1363f057ebf483ae12999e2cb1eb19616189b8c44d5a',
    },
  },
} as const;

/** Hash of the parsed content, so line endings and key order do not matter. */
export function contentHash(value: unknown) {
  const canonical = (item: unknown): unknown =>
    Array.isArray(item)
      ? item.map(canonical)
      : item && typeof item === 'object'
        ? Object.fromEntries(
            Object.entries(item)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, entry]) => [key, canonical(entry)]),
          )
        : item;
  return createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
}

export interface BaselineFiles {
  questions: unknown;
  paraphrases: unknown;
  heldOut: unknown;
}

export function fixtureHashes(files: BaselineFiles) {
  return {
    questions: contentHash(files.questions),
    paraphrases: contentHash(files.paraphrases),
    heldOut: contentHash(files.heldOut),
  };
}

/** The approved overlay is approved-v2; --baseline is the raw fixtures. */
export function expectationsLabel(baseline: boolean) {
  return baseline ? CURRENT_BASELINE : 'approved-v2';
}

/** A fixture as the evaluator holds it, before projection. */
export interface EvaluatedFixture {
  suite: string;
  id?: string;
  locale: string;
  question: string;
  status: string;
  acceptableIds: string[][];
  expectedMode?: string;
  requiresModelCall?: boolean;
  history?: HistoryEntry[];
  expectationOverlay?: boolean;
}

/**
 * The fields of a fixture that decide what is sent to Ask and how the result
 * is judged. Included: suite, id (the row's name in reports), locale as the
 * evaluator resolves it, question, the history after `historyTurns`
 * normalization (the exact turns sent to Ask), the expected status, mode and
 * fact ids, `requiresModelCall` (gate input) and `expectationOverlay`
 * (whether an approved expectation replaced the fixture's own). Excluded:
 * `family` and `category`, which only group rows in the report.
 */
export function evaluatedRow(fixture: EvaluatedFixture) {
  const locale = fixture.locale === 'de' ? 'de' : 'en';
  return {
    suite: fixture.suite,
    id: fixture.id ?? null,
    locale,
    question: fixture.question,
    history: historyTurns(fixture.history, locale),
    status: fixture.status,
    acceptableIds: fixture.acceptableIds,
    expectedMode: fixture.expectedMode ?? null,
    requiresModelCall: Boolean(fixture.requiresModelCall),
    expectationOverlay: Boolean(fixture.expectationOverlay),
  };
}

type BuiltInEntry = {
  locale: string;
  question: string;
  status: string;
  id?: string;
};

/** The default set `--baseline` evaluates: the three fixture files in order. */
export function builtInFixtures(files: BaselineFiles): EvaluatedFixture[] {
  const simple = (suite: string, entries: unknown) =>
    (entries as BuiltInEntry[]).map(({ id, ...entry }) => ({
      ...entry,
      suite,
      acceptableIds: [id ? [id] : []],
    }));
  return [
    ...simple('original', files.questions),
    ...simple('paraphrases', files.paraphrases),
    ...(files.heldOut as EvaluatedFixture[]).map((fixture) => ({
      ...fixture,
      suite: 'held-out',
    })),
  ];
}

export function runIdentity({
  version,
  files,
  evaluated,
}: {
  version: string;
  files: BaselineFiles;
  /** The fixtures actually evaluated, in run order. */
  evaluated: readonly EvaluatedFixture[];
}) {
  const hashes = fixtureHashes(files);
  const rows = evaluated.map(evaluatedRow);
  const expectationHash = contentHash(rows);
  const pin =
    version in BASELINES
      ? BASELINES[version as keyof typeof BASELINES]
      : undefined;
  // A pin describes the full built-in set; a subset, a custom question set or
  // an approved overlay evaluates something else.
  const evaluatesBuiltInSet =
    expectationHash === contentHash(builtInFixtures(files).map(evaluatedRow));
  return {
    version,
    fixtureHashes: hashes,
    expectationHash,
    evaluatedCount: rows.length,
    matchesPin: pin
      ? evaluatesBuiltInSet && contentHash(hashes) === contentHash(pin.fixtures)
      : null,
    baselines: BASELINES,
  };
}
