import { describe, expect, it } from 'vitest';

import { LOCALES, t } from '../i18n';
import { SERVICES, type ServiceStatus } from './services';

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

  it('translates category and description into every locale', () => {
    for (const service of SERVICES) {
      for (const locale of LOCALES) {
        expect(
          service.category[locale]?.trim(),
          `${service.name} category (${locale})`,
        ).toBeTruthy();
        expect(
          service.description[locale]?.trim(),
          `${service.name} description (${locale})`,
        ).toBeTruthy();
      }
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
