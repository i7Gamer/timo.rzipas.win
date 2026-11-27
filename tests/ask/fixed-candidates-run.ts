// Fixed-candidate selector evaluation: the selector gets the expected facts
// plus same-project distractors at several list sizes and orders, so its
// accuracy is measured apart from routing and retrieval.
//
//   node tests/ask/fixed-candidates-run.ts --questions <set.json> [options]
//   node tests/ask/fixed-candidates-run.ts --from-report <report.json> [options]
//
// Options: --sizes 1,6  --shuffles 2  --seed 23  --timeout-ms 6000  --report <out.json>
// --from-report reuses an evaluator report's effective expectations, so
// approved-answers overrides are not rebuilt here.
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import type { Locale } from '../../src/i18n';
import { MAX_CANDIDATES } from '../../services/ask/selection.ts';
import {
  MODEL,
  MODEL_DIGEST,
  selectWithOllama,
} from '../../services/ask/ollama.ts';
import {
  candidateSets,
  effectiveStatus,
  orderings,
  selectionMatches,
  summarize,
} from './fixed-candidates.ts';
import {
  historyTurns,
  parseQuestionSet,
  type HistoryEntry,
} from './question-set.ts';

const SELECTOR_TIMEOUT_MS = 6_000;
const DEFAULT_SIZES = [1, MAX_CANDIDATES];
const DEFAULT_SHUFFLES = 2;
const DEFAULT_SEED = 23;

const flag = (name: string) => {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--'))
    throw new Error(`${name} needs a value`);
  return value;
};

type Case = {
  question: string;
  locale: Locale;
  status: string;
  acceptableIds: string[][];
  history?: HistoryEntry[];
};

function loadCases(): Case[] {
  const questions = flag('--questions');
  const report = flag('--from-report');
  if (Boolean(questions) === Boolean(report))
    throw new Error('Pass exactly one of --questions or --from-report');
  if (questions)
    return parseQuestionSet(
      JSON.parse(readFileSync(questions, 'utf8')),
      basename(questions, extname(questions)),
    );
  const { rows } = JSON.parse(readFileSync(report!, 'utf8')) as {
    rows: {
      question: string;
      locale: Locale;
      expectedStatus: string;
      expectedIds: string[][];
      history?: HistoryEntry[];
    }[];
  };
  return rows.map(
    ({ question, locale, expectedStatus, expectedIds, history }) => ({
      question,
      locale,
      status: expectedStatus,
      acceptableIds: expectedIds,
      ...(history ? { history } : {}),
    }),
  );
}

const sizes = (flag('--sizes') ?? DEFAULT_SIZES.join(','))
  .split(',')
  .map(Number);
if (!sizes.every((size) => Number.isInteger(size) && size >= 1))
  throw new Error('--sizes takes positive whole numbers, e.g. 1,3,6');
// A longer limit than the gateway's compares accuracy, not deadline fit.
const timeoutMs = Number(flag('--timeout-ms') ?? SELECTOR_TIMEOUT_MS);
if (!Number.isInteger(timeoutMs) || timeoutMs < 1)
  throw new Error('--timeout-ms takes a positive whole number');
const shuffles = Number(flag('--shuffles') ?? DEFAULT_SHUFFLES);
const seed = Number(flag('--seed') ?? DEFAULT_SEED);
const cases = loadCases();
const rows = [];
let skipped = 0;
for (const fixture of cases) {
  const sets = candidateSets(fixture, sizes);
  if (!sets.length) skipped += 1;
  const history = historyTurns(fixture.history, fixture.locale);
  for (const set of sets)
    for (const order of orderings(set.facts, shuffles, seed)) {
      const started = performance.now();
      let ids: string[] = [];
      let status = 'error';
      try {
        const decision = await selectWithOllama(
          fixture.question,
          fixture.locale,
          order.items,
          AbortSignal.timeout(timeoutMs),
          history,
        );
        if (decision) {
          const selected = decision.slots.map((slot) => order.items[slot - 1]);
          ids = selected.map(({ id }) => id);
          status = effectiveStatus(decision, selected);
        }
      } catch {
        status = 'error';
      }
      rows.push({
        question: fixture.question,
        locale: fixture.locale,
        size: set.size,
        order: order.label,
        candidates: order.items.map(({ id }) => id),
        expectedStatus: fixture.status,
        expectedIds: fixture.acceptableIds,
        status,
        ids,
        correct:
          status === fixture.status &&
          selectionMatches(ids, fixture.acceptableIds),
        ms: Math.round(performance.now() - started),
      });
    }
}
const summary = summarize(rows);
console.table(
  Object.entries(summary.bySize).map(([size, { correct, total }]) => ({
    size,
    correct,
    total,
  })),
);
console.table(
  Object.entries(summary.byOrder).map(([order, { correct, total }]) => ({
    order,
    correct,
    total,
  })),
);
console.log(
  `overall ${summary.overall.correct}/${summary.overall.total}; ` +
    `${summary.orderSensitive.length} order-sensitive question sizes; ` +
    `${skipped} questions without expected facts skipped`,
);
for (const { question, size } of summary.orderSensitive)
  console.log(`order-sensitive at ${size}: ${question}`);
const out = flag('--report');
if (out)
  await writeFile(
    out,
    JSON.stringify(
      {
        model: MODEL,
        modelDigest: MODEL_DIGEST,
        sizes,
        shuffles,
        seed,
        timeoutMs,
        summary,
        rows,
      },
      null,
      2,
    ) + '\n',
  );
