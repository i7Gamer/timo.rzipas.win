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
  vite: {
    plugins: [tailwindcss()],
    define: {
      'import.meta.env.SITE_LOCALE': JSON.stringify(locale),
    },
  },
});
