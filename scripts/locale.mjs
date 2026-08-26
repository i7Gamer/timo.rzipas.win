import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const locales = JSON.parse(
  readFileSync(new URL('../src/i18n/locales.json', import.meta.url), 'utf8'),
);

const [locale, command = 'dev'] = process.argv.slice(2);
if (!locales.includes(locale)) {
  console.error(
    `Unknown locale "${locale}" — expected one of: ${locales.join(', ')}`,
  );
  process.exit(1);
}

const result = spawnSync('pnpm', ['exec', 'astro', command], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, LOCALE: locale },
});
// null status means the child was killed or failed to spawn — that is a failure.
process.exit(result.status ?? 1);
