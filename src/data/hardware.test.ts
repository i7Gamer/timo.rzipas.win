import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

import { LOCALES, t, ui } from '../i18n';
import { MACHINES, STORAGE_TOTAL } from './hardware';
import { SERVICES } from './services';

const SRC_DIR = join(import.meta.dirname, '..');

describe('MACHINES', () => {
  it('describes at least the server and the workstation', () => {
    expect(MACHINES.length).toBeGreaterThanOrEqual(2);
  });

  it('gives every machine a unique id and terminal title', () => {
    const ids = MACHINES.map((machine) => machine.id);
    const titles = MACHINES.map((machine) => machine.terminalTitle);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('starts every machine with CPU then memory, so the sheets line up', () => {
    for (const machine of MACHINES) {
      expect(machine.specs[0]?.labelKey, machine.id).toBe('homelab.hw.cpu');
      expect(machine.specs[1]?.labelKey, machine.id).toBe('homelab.hw.ram');
    }
  });

  it('reserves the third line for what makes each machine different', () => {
    const thirdLines = MACHINES.map((machine) => machine.specs[2]?.labelKey);
    expect(new Set(thirdLines).size).toBe(thirdLines.length);
  });

  it('resolves every label and value key in every locale', () => {
    for (const machine of MACHINES) {
      expect(t('en', machine.titleKey)).not.toBe(machine.titleKey);
      expect(machine.specs.length).toBeGreaterThan(0);
      for (const spec of machine.specs) {
        for (const locale of LOCALES) {
          expect(t(locale, spec.labelKey), spec.labelKey).not.toBe(
            spec.labelKey,
          );
        }
        if (spec.valueKey !== undefined) {
          expect(ui.en[spec.valueKey], spec.valueKey).toBeTruthy();
        } else {
          expect(spec.value?.trim(), `${machine.id} value`).toBeTruthy();
        }
      }
    }
  });

  it('gives every spec exactly one source of its value', () => {
    for (const machine of MACHINES) {
      for (const spec of machine.specs) {
        const hasLiteral = spec.value !== undefined;
        const hasKey = spec.valueKey !== undefined;
        expect(hasLiteral !== hasKey, `${machine.id}/${spec.labelKey}`).toBe(
          true,
        );
      }
    }
  });
});

describe('STORAGE_TOTAL', () => {
  it('is a plain capacity figure', () => {
    expect(STORAGE_TOTAL).toMatch(/^\d+ TB$/);
  });

  it('is what the copy quotes in every locale', () => {
    for (const locale of LOCALES) {
      expect(t(locale, 'section.homelabTeaser.text')).toContain(STORAGE_TOTAL);
      expect(t(locale, 'homelab.hw.storage.value')).toContain(STORAGE_TOTAL);
      expect(t(locale, 'notFound.message')).toContain(STORAGE_TOTAL);
    }
    const bulkStorage = SERVICES.find(
      (service) => service.name === 'Bulk storage',
    );
    for (const locale of LOCALES) {
      expect(bulkStorage?.description[locale]).toContain(STORAGE_TOTAL);
    }
  });

  it('is the only place the figure is written down', () => {
    const sourceFiles = readdirSync(SRC_DIR, {
      recursive: true,
      encoding: 'utf8',
    }).filter((file) => /\.(ts|astro)$/.test(file));

    const offenders = sourceFiles.filter((file) => {
      if (file.split(sep).join('/') === 'data/hardware.ts') {
        return false;
      }
      return readFileSync(join(SRC_DIR, file), 'utf8').includes(STORAGE_TOTAL);
    });

    expect(offenders).toEqual([]);
  });
});
