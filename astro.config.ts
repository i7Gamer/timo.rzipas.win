import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import locales from './src/i18n/locales.json';

const DEFAULT_LOCALE = locales[0];
// One `astro build` per locale (see scripts/build.mjs); nginx picks the tree at request time.
const locale = process.env.LOCALE ?? DEFAULT_LOCALE;
if (!locales.includes(locale)) {
  throw new Error(
    `Unknown LOCALE "${locale}" — expected one of: ${locales.join(', ')}`,
  );
}

export default defineConfig({
  site: 'https://timo.rzipas.win',
  outDir: `./dist/${locale}`,
  integrations: [sitemap()],
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
    define: {
      'import.meta.env.SITE_LOCALE': JSON.stringify(locale),
    },
  },
});
