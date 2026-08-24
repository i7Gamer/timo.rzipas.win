import { describe, expect, it } from 'vitest';

import { featuredProjects, sortProjects, type Project } from './projects';

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
