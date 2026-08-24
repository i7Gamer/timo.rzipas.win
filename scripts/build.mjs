import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Single source of truth for supported locales, shared with src/i18n.
const locales = JSON.parse(
  readFileSync(new URL('../src/i18n/locales.json', import.meta.url), 'utf8'),
);

for (const locale of locales) {
  console.log(`\n▶ building locale "${locale}" → dist/${locale}\n`);
  const result = spawnSync('pnpm', ['run', 'build:locale'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, LOCALE: locale },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
