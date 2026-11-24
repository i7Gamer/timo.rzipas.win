import { spawnSync } from 'node:child_process';
import { copyFileSync, readFileSync } from 'node:fs';

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

const askMode = process.env.ASK_WORK;
if (askMode === 'local' || askMode === 'index') {
  for (const selected of locales) {
    for (const alternate of locales.filter((locale) => locale !== selected)) {
      copyFileSync(
        new URL(
          `../dist/ask-${askMode}/${alternate}/ask-content.json`,
          import.meta.url,
        ),
        new URL(
          `../dist/ask-${askMode}/${selected}/ask-content-${alternate}.json`,
          import.meta.url,
        ),
      );
    }
  }
}
