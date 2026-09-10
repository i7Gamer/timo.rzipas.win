import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LOCALES, pick, t } from '../i18n';
import {
  featuredProjects,
  projectHref,
  projectName,
  storyProjects,
} from '../lib/projects';
import { JOBS } from './jobs';
import { PROJECTS } from './projects';
import { QUALIFICATIONS } from './qualifications';
import { CV_DOWNLOADS } from './cv';
import { SKILL_GROUPS } from './skills';
import { SERVICES } from './services';
import { CARINI_STORY } from './project-stories';

describe('portfolio content contracts', () => {
  it('keeps the documented qualification award dates', () => {
    expect(QUALIFICATIONS.find((q) => q.id === 'cisco')?.date).toBe(
      '2015-02-19',
    );
    expect(QUALIFICATIONS.find((q) => q.id === 'pma')?.date).toBe('2014-06-04');
  });
  it('has unique safe project slugs and complete stories for the selected projects', () => {
    expect(new Set(PROJECTS.map((p) => p.slug)).size).toBe(PROJECTS.length);
    expect(
      storyProjects(PROJECTS)
        .map((p) => p.slug)
        .sort(),
    ).toEqual(
      [
        'spotify-stats-tracker',
        'myspeed',
        'tutto',
        'this-website',
        'bachelor-thesis',
        'carini-management-system',
      ].sort(),
    );
    for (const project of PROJECTS) {
      expect(project.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(projectHref(project.slug)).toBe(`/projects/${project.slug}/`);
      if (!project.story) continue;
      for (const locale of LOCALES) {
        for (const field of [
          'problem',
          'contribution',
          'decisions',
          'outcome',
        ] as const) {
          expect(project.story[field][locale]?.trim()).toBeTruthy();
        }
        for (const figure of project.story.images ?? []) {
          expect(figure.alt[locale]?.trim()).toBeTruthy();
          expect(figure.caption[locale]?.trim()).toBeTruthy();
          expect(figure.image.width).toBeGreaterThan(0);
          expect(figure.image.height).toBeGreaterThan(0);
        }
      }
    }
  });

  it('retains the substantial MySpeed fork among featured work', () => {
    expect(featuredProjects(PROJECTS).map((p) => p.slug)).toEqual([
      'spotify-stats-tracker',
      'tutto',
      'myspeed',
    ]);
    expect(PROJECTS.find((p) => p.slug === 'myspeed')?.fork).toBe(true);
    expect(storyProjects([])).toEqual([]);
    const withoutStory = { ...PROJECTS[0], story: undefined };
    expect(storyProjects([withoutStory])).toEqual([]);
  });

  it('uses stable experience anchors, separates early internships and explains tutoring gaps', () => {
    expect(new Set(JOBS.map((j) => j.id)).size).toBe(JOBS.length);
    expect(JOBS.filter((j) => !j.to).map((j) => j.id)).toEqual(['abacus']);
    const internship = JOBS.find((j) => j.id === 'stadler-internships')!;
    expect(internship.from.year).toBe(2015);
    expect(internship.to?.year).toBe(2018);
    expect(JOBS.find((j) => j.id === 'early-stadler')).toBeDefined();
    for (const locale of LOCALES) {
      expect(
        JOBS.find((j) => j.id === 'tutoring')?.periodLabel?.[locale],
      ).toContain(';');
      for (const job of JOBS)
        for (const highlight of job.highlights ?? [])
          expect(highlight[locale]?.trim()).toBeTruthy();
    }
  });

  it('provides actual PDF assets for both languages', () => {
    for (const locale of LOCALES) {
      expect(CV_DOWNLOADS[locale]).toContain(`-${locale}.pdf`);
      const bytes = readFileSync(
        resolve('public', CV_DOWNLOADS[locale].slice(1)),
      );
      expect(bytes.subarray(0, '%PDF-'.length).toString()).toBe('%PDF-');
    }
  });

  it('publishes both academic papers with project-specific detail', () => {
    const papers = [
      {
        slug: 'bachelor-thesis',
        path: '/downloads/timo-rzipa-bachelor-thesis.pdf',
        detail: 'Monte Carlo',
      },
      {
        slug: 'carini-management-system',
        path: '/downloads/carini-diploma-thesis.pdf',
        detail: 'Display Templates',
      },
    ] as const;

    for (const paper of papers) {
      const project = PROJECTS.find((entry) => entry.slug === paper.slug)!;
      expect(
        project.sources?.some((source) => source.href === paper.path),
      ).toBe(true);
      expect(Object.values(project.story?.decisions ?? {}).join(' ')).toContain(
        paper.detail,
      );
      const bytes = readFileSync(resolve('public', paper.path.slice(1)));
      expect(bytes.subarray(0, '%PDF-'.length).toString()).toBe('%PDF-');
    }
  });

  it('describes the Carini internship as part of the diploma project', () => {
    expect(CARINI_STORY.outcome.en).toContain('included the internship');
    expect(CARINI_STORY.outcome.de).toContain('einschließlich des Praktikums');
    expect(CARINI_STORY.outcome.en).not.toContain('separate internship');
    expect(CARINI_STORY.outcome.de).not.toContain('separates Praktikum');
  });

  it('provides natural German labels for localized names and project media', () => {
    const bachelor = PROJECTS.find(
      (project) => project.slug === 'bachelor-thesis',
    )!;
    expect(projectName(bachelor, 'de')).toBe('Bachelorarbeit');

    const serviceLabels = Object.fromEntries(
      SERVICES.map((service) => [
        service.name,
        service.displayName ? pick('de', service.displayName) : service.name,
      ]),
    );
    expect(serviceLabels['Bulk Storage']).toBe('Datenspeicher');
    expect(serviceLabels['Local LLM']).toBe('Lokales Sprachmodell');
    expect(t('de', 'project.screenshots')).toBe('Einblicke ins Projekt');
  });

  it('distinguishes course completion and supports skill claims with real anchors', () => {
    expect(QUALIFICATIONS.find((q) => q.id === 'cisco')?.kind).toBe('course');
    expect(QUALIFICATIONS.find((q) => q.id === 'pma')?.kind).toBe(
      'certificate',
    );
    const destinations = new Set([
      ...JOBS.map((j) => `/about/#${j.id}`),
      ...storyProjects(PROJECTS).map((p) => projectHref(p.slug)),
    ]);
    for (const group of SKILL_GROUPS)
      for (const evidence of group.evidence ?? []) {
        expect(destinations.has(evidence.href)).toBe(true);
        for (const locale of LOCALES)
          expect(evidence.text[locale]?.trim()).toBeTruthy();
      }
    for (const q of QUALIFICATIONS)
      for (const locale of LOCALES)
        expect(q.title[locale]?.trim()).toBeTruthy();
  });
});
