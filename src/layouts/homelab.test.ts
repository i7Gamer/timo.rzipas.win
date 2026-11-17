import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { MACHINES } from '../data/hardware';
import { LOCALES, t } from '../i18n';

const HOMELAB_PAGE = readFileSync(
  join(import.meta.dirname, '..', 'pages', 'homelab.astro'),
  'utf8',
);

/** Longest label that still fits the 6rem label column in monospace. */
const MAX_LABEL_CHARS = 10;

describe('homelab hardware row', () => {
  it('shows all machines side by side on wide screens', () => {
    expect(HOMELAB_PAGE).toContain('data-hardware-row');
    expect(HOMELAB_PAGE).toMatch(
      /data-hardware-row[^>]*class="[^"]*lg:grid-cols-3/,
    );
  });

  it('scrolls horizontally with snapping on small screens', () => {
    const row = HOMELAB_PAGE.match(/data-hardware-row[^>]*class="([^"]*)"/)![1];
    for (const cls of [
      'overflow-x-auto',
      'snap-x',
      'snap-mandatory',
      'lg:overflow-visible',
    ]) {
      expect(row.split(' ')).toContain(cls);
    }
    expect(HOMELAB_PAGE).toMatch(/class="[^"]*\bsnap-start\b/);
  });

  it('labels the scrollable row as a region for screen-reader users', () => {
    expect(HOMELAB_PAGE).toMatch(/data-hardware-row[^>]*role="region"/);
    expect(HOMELAB_PAGE).toMatch(
      /data-hardware-row[^>]*aria-label=\{t\(locale, 'homelab.hardware.title'\)\}/,
    );
  });

  it('shows the role line under each machine title', () => {
    expect(HOMELAB_PAGE).toContain('{t(locale, machine.roleKey)}');
    expect(HOMELAB_PAGE.indexOf('machine.roleKey')).toBeGreaterThan(
      HOMELAB_PAGE.indexOf('machine.titleKey'),
    );
  });

  it('uses a narrow label column', () => {
    expect(HOMELAB_PAGE).toContain('grid-cols-[6rem_minmax(0,1fr)]');
    expect(HOMELAB_PAGE).not.toContain('9rem');
  });

  it.each(LOCALES)('keeps every spec label short enough in %s', (locale) => {
    for (const machine of MACHINES) {
      for (const spec of machine.specs) {
        expect(
          t(locale, spec.labelKey).length,
          `${machine.id} ${spec.labelKey}`,
        ).toBeLessThanOrEqual(MAX_LABEL_CHARS);
      }
    }
  });
});
