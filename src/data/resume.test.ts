import { describe, expect, it } from 'vitest';

import { LOCALES } from '../i18n';
import { EDUCATION } from './education';
import { JOBS } from './jobs';
import { SKILL_GROUPS, SPOKEN_LANGUAGES } from './skills';

describe('JOBS', () => {
  it('translates role, location and summary into every locale', () => {
    for (const job of JOBS) {
      for (const locale of LOCALES) {
        expect(
          job.role[locale]?.trim(),
          `${job.company} role (${locale})`,
        ).toBeTruthy();
        expect(
          job.location[locale]?.trim(),
          `${job.company} location (${locale})`,
        ).toBeTruthy();
        expect(
          job.summary[locale]?.trim(),
          `${job.company} summary (${locale})`,
        ).toBeTruthy();
      }
    }
  });

  it('links every employer with an https URL', () => {
    for (const job of JOBS) {
      expect(job.url, `${job.company} url`).toMatch(/^https:\/\//);
    }
  });
});

describe('EDUCATION', () => {
  it('translates every degree and links every school', () => {
    for (const entry of EDUCATION) {
      for (const locale of LOCALES) {
        expect(
          entry.degree[locale]?.trim(),
          `${entry.school} degree (${locale})`,
        ).toBeTruthy();
      }
      expect(entry.url, `${entry.school} url`).toMatch(/^https:\/\//);
    }
  });
});

describe('SKILL_GROUPS', () => {
  it('translates every group title into every locale', () => {
    for (const group of SKILL_GROUPS) {
      for (const locale of LOCALES) {
        expect(
          group.title[locale]?.trim(),
          `group title (${locale})`,
        ).toBeTruthy();
      }
    }
  });

  it('lists unique, non-empty items in every group', () => {
    for (const group of SKILL_GROUPS) {
      expect(group.items.length, group.title.en).toBeGreaterThan(0);
      expect(new Set(group.items).size, group.title.en).toBe(
        group.items.length,
      );
      for (const item of group.items) {
        expect(item.trim()).toBeTruthy();
      }
    }
  });
});

describe('SPOKEN_LANGUAGES', () => {
  it('translates name and level into every locale', () => {
    for (const language of SPOKEN_LANGUAGES) {
      for (const locale of LOCALES) {
        expect(language.name[locale]?.trim()).toBeTruthy();
        expect(language.level[locale]?.trim()).toBeTruthy();
      }
    }
  });
});
