// Real-Chromium packaged smokes. Each block runs only when its URL is set, so
// the normal `pnpm test` skips them. The Happy DOM test in
// packaged-outage.test.ts stays; this adds the same turns in a real browser.
//
//   ASK_SMOKE_URL  the Ask stack with the gateway stopped (ask-smoke job)
//   ASK_OFF_URL    the normal image, where Ask is off (smoke job)
//
// ASK_CHROMIUM_PATH selects an installed browser instead of the downloaded
// Chromium (`pnpm exec playwright-core install chromium`).
import { chromium, type Browser } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const askUrl = process.env.ASK_SMOKE_URL;
const offUrl = process.env.ASK_OFF_URL;
const GATEWAY_STOPPED = 503;
const NOT_FOUND = 404;
const TURN_TIMEOUT_MS = 15_000;
const DISCLOSURE_TIMEOUT_MS = 5_000;
const TEST_TIMEOUT_MS = 45_000;
const CITED_PAGE = '/homelab/';
const LOCALES = ['en', 'de'] as const;
const TURNS = [
  { locale: 'en', question: 'What is the dev server?' },
  { locale: 'de', question: 'Was ist der Dev-Server?' },
] as const;
const OFF_ROUTES = ['/api/ask', '/ask-content-en.json', '/ask-facts.json'];

let browser: Browser;
beforeAll(async () => {
  if (!askUrl && !offUrl) return;
  browser = await chromium.launch({
    executablePath: process.env.ASK_CHROMIUM_PATH || undefined,
  });
});
afterAll(async () => {
  await browser?.close();
});

async function openPage(origin: string, locale: string) {
  const context = await browser.newContext({ baseURL: origin });
  await context.addCookies([{ name: 'lang', value: locale, url: origin }]);
  return { context, page: await context.newPage() };
}

describe.skipIf(!askUrl)('Chromium with the Ask gateway stopped', () => {
  it.each(TURNS)(
    '$locale renders a reviewed excerpt and citation',
    async ({ locale, question }) => {
      const origin = new URL(askUrl!).origin;
      const { context, page } = await openPage(origin, locale);
      try {
        const statuses: number[] = [];
        page.on('response', (response) => {
          if (new URL(response.url()).pathname === '/api/ask')
            statuses.push(response.status());
        });
        await page.goto('/');
        expect(await page.locator('html').getAttribute('lang')).toBe(locale);
        const panel = page.locator('[data-ask-work]');
        // The chat sits in a closed disclosure, as for a first-time visitor.
        const input = panel.locator('textarea');
        await panel.locator('summary.ask-summary').first().click();
        await expect
          .poll(() => input.isVisible(), { timeout: DISCLOSURE_TIMEOUT_MS })
          .toBe(true);
        await input.fill(question);
        await input.press('Enter');
        const citation = panel.locator(
          `[data-ask-result] a[href^="${CITED_PAGE}"]`,
        );
        await citation.first().waitFor({ timeout: TURN_TIMEOUT_MS });
        expect(statuses).toEqual([GATEWAY_STOPPED]);
        const text = (
          await panel.locator('[data-ask-result]').innerText()
        ).trim();
        expect(text).not.toBe('');
      } finally {
        await context.close();
      }
    },
    TEST_TIMEOUT_MS,
  );
});

describe.skipIf(!offUrl)('Chromium on the normal image keeps Ask off', () => {
  it.each(LOCALES)('%s has no Ask panel and no Ask routes', async (locale) => {
    const origin = new URL(offUrl!).origin;
    const { context, page } = await openPage(origin, locale);
    try {
      const response = await page.goto('/');
      expect(response?.status()).toBe(200);
      expect(await page.locator('html').getAttribute('lang')).toBe(locale);
      expect(await page.locator('[data-ask-work]').count()).toBe(0);
      for (const route of OFF_ROUTES)
        expect((await page.request.get(route)).status(), route).toBe(NOT_FOUND);
    } finally {
      await context.close();
    }
  });
});
