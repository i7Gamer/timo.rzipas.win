import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import {
  CLIENT_TIMEOUT,
  facts,
  validateResult,
  type AskResult,
} from '../../src/lib/ask/catalog.ts';
import { corpusVersion } from '../../src/lib/ask/version.ts';

const args = process.argv.slice(2);
const origin = new URL(
  args.find((arg) => !arg.startsWith('--')) ?? 'http://127.0.0.1:18093',
).origin;
const startup = args.includes('--startup');
const offline = args.includes('--offline');
const gatewayOffline = args.includes('--gateway-offline');
const STARTUP_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 500;
const localTimings: number[] = [];

function request(path: string, options?: RequestInit) {
  return fetch(new URL(path, origin), {
    ...options,
    redirect: 'manual',
    signal: AbortSignal.timeout(CLIENT_TIMEOUT),
  });
}

function ask(
  question: string,
  locale: AskResult['locale'],
  requestOrigin = origin,
) {
  return request('/api/ask', {
    method: 'POST',
    headers: { Origin: requestOrigin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, locale }),
  });
}

async function expectAnswer(
  question: string,
  locale: AskResult['locale'],
  ids: string[],
  mode?: AskResult['mode'],
) {
  const started = performance.now();
  const response = await ask(question, locale);
  assert.equal(response.status, 200, question);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const result = validateResult(await response.json(), locale, corpusVersion);
  assert.ok(
    result,
    'response must use the same reviewed corpus as this checkout',
  );
  if (mode) assert.equal(result.mode, mode);
  assert.equal(result.status, ids.length ? 'answer' : 'unknown');
  assert.deepEqual(
    result.claims.map(({ id }) => id),
    ids,
  );
  assert.deepEqual(
    result.sources.map(({ id }) => id),
    [
      ...new Set(
        ids.map((id) => facts.find((fact) => fact.id === id)?.sourceId),
      ),
    ],
  );
  const ms = Math.round(performance.now() - started);
  if (result.mode === 'local') localTimings.push(ms);
  console.log(
    'answer',
    JSON.stringify({
      locale,
      status: result.status,
      ids: result.claims.map(({ id }) => id),
      citations: result.sources,
      mode: result.mode,
      ms,
    }),
  );
}

if (!gatewayOffline) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  for (;;) {
    const response = await request('/api/ask').catch(() => undefined);
    if (response?.status === 405) break;
    assert.ok(Date.now() < deadline, 'Ask gateway did not start through nginx');
    await delay(POLL_INTERVAL_MS);
  }
}

assert.equal((await request('/healthz')).status, 200);
for (const locale of ['en', 'de']) {
  const headers = { Cookie: 'lang=' + locale };
  const response = await request('/', {
    headers,
  });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, new RegExp('<html lang="' + locale + '"'));
  assert.match(html, /data-ask-work/);
  assert.match(html, /id="ask-work-history"/);
  assert.match(
    html,
    new RegExp('/downloads/timo-rzipa-cv-' + locale + '\\.pdf'),
  );
  assert.match(html, /\/projects\/spotify-stats-tracker\/#contribution/);
  for (const indexLocale of ['en', 'de']) {
    const path = '/ask-content-' + indexLocale + '.json';
    const index = await request(path, { headers });
    const label = path + ' with lang=' + locale;
    assert.equal(index.status, 200, label);
    assert.equal((await index.json()).locale, indexLocale, label);
  }
}

assert.equal((await request('/api/tags')).status, 404);
assert.equal((await request('/api/ask/')).status, 404);
const englishFlask = 'Which project used Flask?';
const germanFlask = 'Wofür hat Timo Flask eingesetzt?';
if (offline || gatewayOffline) {
  if (offline) {
    const work = ['abacus-workflow', 'stadler-vpn', 'stadler-plugins'];
    await expectAnswer('Summarize work', 'en', work, 'index');
    await expectAnswer('Fass Timos Arbeit zusammen', 'de', work, 'index');
  }
  for (const [locale, question] of [
    ['en', englishFlask],
    ['de', germanFlask],
  ] as const) {
    const started = performance.now();
    const response = await ask(question, locale);
    const ms = Math.round(performance.now() - started);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    console.log(
      'outage',
      JSON.stringify({
        phase: gatewayOffline ? 'gateway-stopped' : 'ollama-paused',
        locale,
        httpStatus: response.status,
        ms,
      }),
    );
  }
} else {
  assert.equal(
    (await ask('Which project used Flask?', 'en', 'https://example.org'))
      .status,
    403,
  );
  const projects = ['spotify-rewrite', 'myspeed-fork', 'tutto-modes'];
  await expectAnswer('Tell me about your projects.', 'en', projects, 'index');
  await expectAnswer('Welche Projekte gibt es?', 'de', projects, 'index');
  if (startup) {
    const work = ['abacus-workflow', 'stadler-vpn', 'stadler-plugins'];
    await expectAnswer('Summarize work', 'en', work, 'index');
    await expectAnswer('Fass Timos Arbeit zusammen', 'de', work, 'index');
  } else {
    await expectAnswer(germanFlask, 'de', ['spotify-python'], 'local');
    await expectAnswer(englishFlask, 'en', ['spotify-python'], 'local');
    await expectAnswer('Who won the 2002 World Cup?', 'en', []);
  }
}

const phase = startup
  ? 'Ask container startup'
  : gatewayOffline
    ? 'Gateway offline'
    : offline
      ? 'Inference offline'
      : 'Local inference';
console.log(phase + ' smoke passed in English and German');
if (localTimings.length) {
  const warm = [...localTimings].sort((a, b) => a - b);
  console.log(
    'warm inference latency',
    JSON.stringify({
      warmSamples: warm.length,
      warmP95Ms: warm[Math.ceil(warm.length * 0.95) - 1],
    }),
  );
}
