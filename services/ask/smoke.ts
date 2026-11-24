import assert from 'node:assert/strict';
import { validateResult, type AskResult } from '../../src/lib/ask/catalog.ts';
import { corpusVersion } from '../../src/lib/ask/version.ts';

const origin = new URL(process.argv[2] ?? 'http://127.0.0.1:18093').origin;
const offline = process.argv.includes('--offline');

function request(path: string, options?: RequestInit) {
  return fetch(new URL(path, origin), {
    ...options,
    redirect: 'manual',
    signal: AbortSignal.timeout(9_000),
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
  mode: AskResult['mode'],
  ids: string[],
) {
  const response = await ask(question, locale);
  assert.equal(response.status, 200, question);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const result = validateResult(await response.json(), locale, corpusVersion);
  assert.ok(
    result,
    'response must use the same reviewed corpus as this checkout',
  );
  assert.equal(result.mode, mode);
  assert.equal(result.status, ids.length ? 'answer' : 'unknown');
  assert.deepEqual(
    result.claims.map(({ id }) => id),
    ids,
  );
}

assert.equal((await request('/healthz')).status, 200);
for (const locale of ['en', 'de']) {
  const response = await request('/', {
    headers: { Cookie: 'lang=' + locale },
  });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, new RegExp('<html lang="' + locale + '"'));
  assert.match(html, /data-ask-work/);
  assert.match(
    html,
    new RegExp('/downloads/timo-rzipa-cv-' + locale + '\\.pdf'),
  );
  assert.match(html, /\/projects\/spotify-stats-tracker\/#contribution/);
}

assert.equal((await request('/api/tags')).status, 404);
assert.equal((await request('/api/ask/')).status, 404);
if (offline) {
  const response = await ask('Which project used Flask?', 'en');
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
} else {
  assert.equal((await request('/api/ask')).status, 405);
  assert.equal(
    (await ask('Which project used Flask?', 'en', 'https://example.org'))
      .status,
    403,
  );
  await expectAnswer('Tell me about your projects.', 'en', 'index', [
    'spotify-rewrite',
    'myspeed-fork',
    'tutto-modes',
  ]);
  await expectAnswer('Wofür hat Timo Flask eingesetzt?', 'de', 'local', [
    'spotify-python',
  ]);
  await expectAnswer('Which project used Flask?', 'en', 'local', [
    'spotify-python',
  ]);
  await expectAnswer('Who won the 2002 World Cup?', 'en', 'index', []);
}

console.log(
  offline ? 'Offline fallback smoke passed' : 'Local inference smoke passed',
);
