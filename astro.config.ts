import { defineConfig } from 'astro/config';
import type { AstroIntegration } from 'astro';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import locales from './src/i18n/locales.json';
import {
  graniteLocal,
  localPorts,
  LOOPBACK,
} from './services/ask/local-profile';
import { writeSiteContent } from './scripts/ask-content';
import type { Locale } from './src/i18n';

const DEFAULT_LOCALE = locales[0];
// One `astro build` per locale (see scripts/build.mjs); nginx picks the tree at request time.
const locale = process.env.LOCALE ?? DEFAULT_LOCALE;
if (!locales.includes(locale)) {
  throw new Error(
    `Unknown LOCALE "${locale}" — expected one of: ${locales.join(', ')}`,
  );
}

const askMode = process.env.ASK_WORK ?? 'off';
if (!['off', 'index', 'local'].includes(askMode)) {
  throw new Error('ASK_WORK must be off, index, or local');
}
const askPreview = {
  host: LOOPBACK,
  port: locale === 'de' ? localPorts.de : localPorts.en,
  strictPort: true,
  proxy:
    askMode === 'local'
      ? {
          [graniteLocal ? '^/api/ask(?:-local-pets)?$' : '^/api/ask$']: {
            target: `http://${LOOPBACK}:${localPorts.gateway}`,
            changeOrigin: false,
          },
        }
      : undefined,
};

export default defineConfig({
  site: 'https://timo.rzipas.win',
  outDir:
    askMode === 'off' ? `./dist/${locale}` : `./dist/ask-${askMode}/${locale}`,
  integrations: [
    sitemap(),
    ...(askMode === 'off'
      ? []
      : [
          {
            name: 'ask-site-content',
            hooks: {
              'astro:build:done': ({ dir }) =>
                writeSiteContent(dir, locale as Locale),
            },
          } satisfies AstroIntegration,
        ]),
  ],
  ...(askMode === 'off'
    ? {}
    : { server: { host: askPreview.host, port: askPreview.port } }),
  security: {
    // Page-level policy in a <meta>, with a hash for every inline script and
    // style Astro emits; deploy/security-headers.conf carries only what a
    // <meta> cannot (frame-ancestors). src/deploy.test.ts keeps both in step.
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
      ],
    },
  },
  vite: {
    plugins: [tailwindcss()],
    server: {
      ...(askMode === 'off' ? {} : askPreview),
      // Vite replaces rather than extends this list.
      fs: {
        deny: [
          '.env',
          '.env.*',
          '*.{crt,pem,key,p12,pfx,cer,der}',
          '.npmrc',
          '.yarnrc.yml',
          '**/.git/**',
          '**/.local-ask/**',
        ],
      },
    },
    ...(askMode === 'off' ? {} : { preview: askPreview }),
    define: {
      'import.meta.env.SITE_LOCALE': JSON.stringify(locale),
      'import.meta.env.ASK_WORK_MODE': JSON.stringify(askMode),
      'import.meta.env.ASK_LOCAL_PETS': JSON.stringify(
        askMode === 'local' && graniteLocal,
      ),
    },
  },
});
