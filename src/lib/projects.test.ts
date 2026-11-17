import { describe, expect, it } from 'vitest';

import {
  featuredProjects,
  projectName,
  projectSources,
  sortProjects,
  type Project,
} from './projects';

function makeProject(overrides: Partial<Project>): Project {
  return {
    slug: 'example',
    name: 'Example',
    tagline: { en: 'tagline' },
    description: { en: 'description' },
    tech: ['TypeScript'],
    status: 'active',
    featured: false,
    order: 0,
    ...overrides,
  };
}

describe('sortProjects', () => {
  it('sorts ascending by order', () => {
    const projects = [
      makeProject({ slug: 'c', order: 3 }),
      makeProject({ slug: 'a', order: 1 }),
      makeProject({ slug: 'b', order: 2 }),
    ];
    expect(sortProjects(projects).map((p) => p.slug)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the input array', () => {
    const projects = [
      makeProject({ slug: 'b', order: 2 }),
      makeProject({ slug: 'a', order: 1 }),
    ];
    sortProjects(projects);
    expect(projects[0].slug).toBe('b');
  });

  it('handles an empty list', () => {
    expect(sortProjects([])).toEqual([]);
  });
});

describe('featuredProjects', () => {
  it('returns only featured projects, sorted by order', () => {
    const projects = [
      makeProject({ slug: 'plain', order: 0 }),
      makeProject({ slug: 'second', order: 5, featured: true }),
      makeProject({ slug: 'first', order: 2, featured: true }),
    ];
    expect(featuredProjects(projects).map((p) => p.slug)).toEqual([
      'first',
      'second',
    ]);
  });

  it('returns an empty list when nothing is featured', () => {
    expect(featuredProjects([makeProject({})])).toEqual([]);
  });
});

describe('projectName', () => {
  it('uses the localized display name when one is provided', () => {
    const project = makeProject({
      name: 'Bachelor thesis',
      displayName: { en: 'Bachelor thesis', de: 'Bachelorarbeit' },
    });

    expect(projectName(project, 'de')).toBe('Bachelorarbeit');
  });

  it('falls back to the canonical project name', () => {
    expect(projectName(makeProject({ name: 'Tutto' }), 'de')).toBe('Tutto');
  });
});

describe('projectSources', () => {
  const sources = [
    {
      href: 'https://example.com/web',
      label: { en: 'Web', de: 'Web-Frontend' },
    },
    {
      href: 'https://example.com/api',
      label: { en: 'API', de: 'API-Backend' },
    },
  ];

  it.each([
    ['en', ['Web', 'API']],
    ['de', ['Web-Frontend', 'API-Backend']],
  ] as const)(
    'maps explicit sources to localized labels in %s',
    (locale, labels) => {
      const result = projectSources(makeProject({ sources }), locale);
      expect(result.map((s) => s.label)).toEqual(labels);
      expect(result.map((s) => s.href)).toEqual([
        'https://example.com/web',
        'https://example.com/api',
      ]);
    },
  );

  it.each([
    ['en', 'Source'],
    ['de', 'Quellcode'],
  ] as const)(
    'falls back to the repo with a generic label in %s',
    (locale, label) => {
      const repo = 'https://github.com/i7Gamer/demo';
      expect(projectSources(makeProject({ repo }), locale)).toEqual([
        { href: repo, label },
      ]);
    },
  );

  it('returns an empty list without sources or repo', () => {
    expect(projectSources(makeProject({}), 'en')).toEqual([]);
  });

  it('prefers explicit sources over the repo', () => {
    const result = projectSources(
      makeProject({ sources, repo: 'https://github.com/i7Gamer/demo' }),
      'en',
    );
    expect(result).toHaveLength(sources.length);
  });
});
