import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';

import type { Service } from '../data/services';
import type { Project } from '../lib/projects';
import ProjectCard from './ProjectCard.astro';
import ServiceCard from './ServiceCard.astro';
import TimelineItem from './TimelineItem.astro';

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

describe('ProjectCard live links', () => {
  const hosted: Project = { ...project, link: 'https://demo.rzipas.win/' };

  it('offers a visit link when the project is hosted somewhere', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ProjectCard, {
      props: { project: hosted, locale: 'en' },
    });
    expect(html).toContain('https://demo.rzipas.win/');
    expect(html).toContain('Visit');
  });

  it('translates the visit link', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ProjectCard, {
      props: { project: hosted, locale: 'de' },
    });
    expect(html).toContain('Ansehen');
  });

  it('omits it for projects that are not hosted', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ProjectCard, {
      props: { project, locale: 'en' },
    });
    expect(html).not.toContain('Visit');
  });

  it('opens external links in a new tab', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ProjectCard, {
      props: { project: hosted, locale: 'en' },
    });
    expect(html.match(/target="_blank"/g)).toHaveLength(2);
    // The ↗ arrow comes from the a[target="_blank"] rule in global.css;
    // the markup must neither repeat it nor opt out of it.
    expect(html).not.toContain('↗');
    expect(html).not.toContain('data-no-arrow');
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

describe('TimelineItem', () => {
  const props = {
    period: 'Sep 2019 – today',
    title: 'Software Engineer',
    org: 'ACME AG',
  };

  it('opens the org link in a new tab, without opting out of the arrow', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(TimelineItem, {
      props: { ...props, orgUrl: 'https://acme.example' },
    });
    expect(html).toContain('https://acme.example');
    expect(html).toContain('target="_blank"');
    expect(html).not.toContain('data-no-arrow');
  });

  it('renders the org as plain text without a URL', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(TimelineItem, { props });
    expect(html).toContain('ACME AG');
    expect(html).not.toContain('target="_blank"');
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
