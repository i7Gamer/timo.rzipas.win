import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';

import type { Service } from '../data/services';
import type { Project } from '../lib/projects';
import ProjectCard from './ProjectCard.astro';
import ServiceCard from './ServiceCard.astro';

const project: Project = {
  slug: 'demo',
  name: 'DemoTool',
  tagline: { en: 'English tagline', de: 'Deutscher Untertitel' },
  description: { en: 'English description', de: 'Deutsche Beschreibung' },
  tech: ['TypeScript', 'Docker'],
  repo: 'https://github.com/i7Gamer/demo',
  status: 'active',
  featured: true,
  order: 1,
};

const service: Service = {
  name: 'DemoService',
  category: { en: 'Web', de: 'Web' },
  description: { en: 'English service text', de: 'Deutscher Diensttext' },
  status: 'planned',
};

describe('ProjectCard', () => {
  it('renders English content with links and tags', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ProjectCard, {
      props: { project, locale: 'en' },
    });
    expect(html).toContain('DemoTool');
    expect(html).toContain('English tagline');
    expect(html).toContain('English description');
    expect(html).toContain('https://github.com/i7Gamer/demo');
    expect(html).toContain('Source');
    expect(html).toContain('active');
    expect(html).toContain('TypeScript');
  });

  it('renders German content for the de locale', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ProjectCard, {
      props: { project, locale: 'de' },
    });
    expect(html).toContain('Deutscher Untertitel');
    expect(html).toContain('Deutsche Beschreibung');
    expect(html).toContain('Quellcode');
    expect(html).toContain('aktiv');
  });
});

describe('ProjectCard forks', () => {
  const forked: Project = { ...project, name: 'ForkedTool', fork: true };

  it('shows the fork badge next to the status badge', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ProjectCard, {
      props: { project: forked, locale: 'en' },
    });
    expect(html).toContain('fork');
    expect(html).toContain('active');
  });

  it('translates both badges', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ProjectCard, {
      props: { project: forked, locale: 'de' },
    });
    expect(html).toContain('Fork');
    expect(html).toContain('aktiv');
  });

  it('keeps the fork badge off projects that are not forks', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ProjectCard, {
      props: { project, locale: 'en' },
    });
    expect(html).not.toContain('fork');
  });

  it('pairs the fork badge with an archived status too', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ProjectCard, {
      props: { project: { ...forked, status: 'archived' }, locale: 'en' },
    });
    expect(html).toContain('fork');
    expect(html).toContain('archived');
  });
});

describe('ServiceCard', () => {
  it('renders English content with the status label', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ServiceCard, {
      props: { service, locale: 'en' },
    });
    expect(html).toContain('DemoService');
    expect(html).toContain('English service text');
    expect(html).toContain('planned');
  });

  it('renders German content with the translated status', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ServiceCard, {
      props: { service, locale: 'de' },
    });
    expect(html).toContain('Deutscher Diensttext');
    expect(html).toContain('geplant');
  });
});
