// Packaged outage smoke: with the Ask gateway stopped, one English and one
// German browser turn must still render a reviewed page excerpt and its
// citation. It runs against a packaged stack only when ASK_SMOKE_URL is set:
//
//   docker compose -p ask-ci -f deploy/docker-compose.ask.yml stop ask
//   ASK_SMOKE_URL=http://127.0.0.1:18093 pnpm vitest run src/lib/ask/packaged-outage.test.ts
import { Window } from 'happy-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setupAskWork } from './browser';

const origin = process.env.ASK_SMOKE_URL;
const GATEWAY_STOPPED = 503;
const TURN_TIMEOUT_MS = 15_000;
const TEST_TIMEOUT_MS = 30_000;
const networkFetch = globalThis.fetch;
const CITED_PAGE = '/homelab/';
const TURNS = [
  { locale: 'en', question: 'What is the dev server?' },
  { locale: 'de', question: 'Was ist der Dev-Server?' },
] as const;

describe.skipIf(!origin)(
  'packaged browser fallback with the gateway stopped',
  () => {
    afterEach(() => vi.unstubAllGlobals());

    it.each(TURNS)(
      '$locale renders a reviewed excerpt and citation',
      async ({ locale, question }) => {
        const base = new URL(origin!).origin;
        const headers = { Cookie: 'lang=' + locale };
        const page = await networkFetch(base + '/', { headers });
        expect(page.status).toBe(200);
        const window = new Window({ url: base + '/' });
        const gatewayStatuses: number[] = [];
        try {
          vi.stubGlobal(
            'fetch',
            vi.fn<typeof fetch>(async (input, init) => {
              const url = new URL(String(input), base);
              const response = await networkFetch(url, {
                ...init,
                headers: { ...headers, Origin: base, ...init?.headers },
              });
              if (url.pathname === '/api/ask')
                gatewayStatuses.push(response.status);
              return response;
            }),
          );
          vi.stubGlobal('document', window.document);
          window.document.write(await page.text());
          const panel = window.document.querySelector(
            '[data-ask-work]',
          ) as unknown as HTMLElement | null;
          expect(
            panel,
            'Ask panel missing from the packaged page',
          ).not.toBeNull();
          setupAskWork(panel!);
          panel!.querySelector('textarea')!.value = question;
          panel!
            .querySelector('form')!
            .dispatchEvent(new window.Event('submit') as unknown as Event);
          const result = panel!.querySelector('[data-ask-result]')!;
          await vi.waitFor(
            () =>
              expect(
                result.querySelector(`a[href^="${CITED_PAGE}"]`),
              ).not.toBeNull(),
            { timeout: TURN_TIMEOUT_MS },
          );
          expect(gatewayStatuses).toEqual([GATEWAY_STOPPED]);
          const messages = JSON.parse(panel!.dataset.messages ?? '{}') as {
            offline?: string;
            wait?: string;
          };
          const text = result.textContent ?? '';
          expect(text.trim()).not.toBe('');
          for (const message of [messages.offline, messages.wait])
            if (message) expect(text).not.toContain(message);
        } finally {
          await window.happyDOM.close();
        }
      },
      TEST_TIMEOUT_MS,
    );
  },
);
