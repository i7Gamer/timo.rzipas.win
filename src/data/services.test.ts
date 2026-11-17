import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { LOCALES, t } from '../i18n';
import { PROJECTS } from './projects';
import { SERVICE_GROUPS, SERVICES, type ServiceStatus } from './services';

const STATUSES = [
  'online',
  'planned',
] as const satisfies readonly ServiceStatus[];

describe('SERVICES', () => {
  it('lists every service exactly once', () => {
    const names = SERVICES.map((service) => service.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('uses only known statuses', () => {
    for (const service of SERVICES) {
      expect(STATUSES).toContain(service.status);
    }
  });

  it('translates the description into every locale', () => {
    for (const service of SERVICES) {
      for (const locale of LOCALES) {
        expect(
          service.description[locale]?.trim(),
          `${service.name} description (${locale})`,
        ).toBeTruthy();
      }
    }
  });

  it('no longer carries a category, which only repeated the group', () => {
    for (const service of SERVICES) {
      expect('category' in service, service.name).toBe(false);
    }
  });

  it('has a status label in every locale for every status', () => {
    for (const status of STATUSES) {
      const key = `status.${status}` as const;
      for (const locale of LOCALES) {
        expect(t(locale, key)).not.toBe(key);
      }
    }
  });
});

/**
 * The homelab page only has a card — and therefore a live dot — for names in
 * SERVICES. A name the homelab polls but the site does not list is silently
 * dropped by applyLiveStatus, so a rename on either side goes unnoticed.
 *
 * Only update-status.ps1 is checked. deploy/status/status.json is generated
 * from its $Checks table and is gitignored, so it is absent on a fresh
 * checkout; guarding the source covers the generated file anyway.
 *
 * Not an equality check: SERVICES may list things with no HTTP endpoint to
 * poll (bulk storage is a disk array, not a service).
 */
const STATUS_SCRIPT = join(
  import.meta.dirname,
  '../../deploy/update-status.ps1',
);

/** Service names the status script polls, from its $Checks table. */
function polledNames(): string[] {
  const script = readFileSync(STATUS_SCRIPT, 'utf8');
  // Keys are single- or double-quoted (names may contain an apostrophe).
  const entry = /^\s+(?:'([^']*)'|"([^"]*)")\s*=\s*'https?:/gm;
  return [...script.matchAll(entry)].map(
    ([, single, double]) => single ?? double,
  );
}

describe('homelab status checks', () => {
  // Without this, a matcher that silently stopped matching would make the
  // subset assertion below pass vacuously.
  it('actually finds names in the status script', () => {
    expect(polledNames().length).toBeGreaterThan(10);
  });

  it('polls only services the site lists', () => {
    const listed = new Set(SERVICES.map((service) => service.name));
    for (const name of polledNames()) {
      expect(listed, `update-status.ps1: ${name}`).toContain(name);
    }
  });
});

describe('built by me group', () => {
  const mine = SERVICES.filter((service) => service.group === 'mine');

  it('comes first and is the only group open by default', () => {
    expect(SERVICE_GROUPS[0].id).toBe('mine');
    expect(
      SERVICE_GROUPS.filter((group) => 'open' in group && group.open).map(
        (group) => group.id,
      ),
    ).toEqual(['mine']);
  });

  it('holds this site, Tutto, SpotifyTracker and MySpeed', () => {
    expect(mine.map((service) => service.name).sort()).toEqual(
      ['MySpeed', 'SpotifyTracker', 'Tutto', 'timo.rzipas.win'].sort(),
    );
  });

  it('links each to its project story, marking MySpeed as a contribution', () => {
    for (const service of mine) {
      const project = PROJECTS.find(
        (entry) => entry.slug === service.project?.slug,
      );
      expect(project?.story, service.name).toBeDefined();
      expect(service.project?.role, service.name).toBe(
        service.name === 'MySpeed' ? 'contributor' : 'own',
      );
    }
  });

  it('links projects only from the built by me group', () => {
    for (const service of SERVICES.filter((entry) => entry.group !== 'mine')) {
      expect(service.project, service.name).toBeUndefined();
    }
  });
});
