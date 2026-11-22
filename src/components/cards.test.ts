import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';

import type { Service } from '../data/services';
import { PROJECTS } from '../data/projects';
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
  group: 'infrastructure',
  description: { en: 'English service text', de: 'Deutscher Diensttext' },
  status: 'planned',
};

describe('ProjectCard', () => {
  it.each(['en', 'de'] as const)(
    'links the bachelor thesis and both repositories in %s',
    async (locale) => {
      const container = await AstroContainer.create();
      const thesis = PROJECTS.find(
        (entry) => entry.slug === 'bachelor-thesis',
      )!;
      const html = await container.renderToString(ProjectCard, {
        props: { project: thesis, locale },
      });
      expect(html).toContain(
        'href="https://github.com/i7Gamer/BachelorThesisWEB"',
      );
      expect(html).toContain(
        'href="https://github.com/i7Gamer/BachelorThesisREST"',
      );
      expect(html).toContain(
        'href="/downloads/timo-rzipa-bachelor-thesis.pdf"',
      );
      expect(html).toContain(locale === 'en' ? 'Web frontend' : 'Web-Frontend');
      expect(html).toContain(locale === 'en' ? 'REST backend' : 'REST-Backend');
      expect(html).toContain(
        locale === 'en' ? 'Bachelor thesis · PDF' : 'Bachelorarbeit · PDF',
      );
      expect(html).toContain(
        locale === 'en' ? '>Bachelor thesis</' : '>Bachelorarbeit</',
      );
      expect(html).toContain(
        locale === 'en' ? 'My contribution' : 'Mein Beitrag',
      );
      expect(html.match(/target="_blank"/g)).toHaveLength(3);
      expect(html).not.toContain('↗');
    },
  );
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
    expect(html).toContain('text-fork');
    expect(html).toContain('bg-fork-soft');
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

  it('renders an internal project detail link without opening a new tab', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(TimelineItem, {
      props: {
        ...props,
        detailHref: '/projects/carini-management-system/',
        detailLabel: 'View diploma project',
      },
    });

    expect(html).toContain('href="/projects/carini-management-system/"');
    expect(html).toContain('View diploma project');
    expect(html).not.toContain('target="_blank"');
  });

  const full = {
    ...props,
    summary: 'Did things',
    highlights: ['Highlight one'],
    tags: ['Java'],
  };

  it('shows everything openly by default, in larger text', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(TimelineItem, {
      props: full,
    });
    expect(html).not.toContain('<details');
    expect(html).toMatch(/class="[^"]*text-base[^"]*">Did things/);
    expect(html).toMatch(/<ul class="[^"]*text-base[^"]*space-y-2/);
    expect(html).toContain('pb-12');
  });

  it('folds the details behind the heading when collapsed', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(TimelineItem, {
      props: { ...full, collapsed: true },
    });
    const details = html.slice(html.indexOf('<details'));
    const summary = details.slice(
      details.indexOf('<summary'),
      details.indexOf('</summary>'),
    );
    expect(html).toContain('<details data-print-open');
    expect(details).not.toMatch(/<details[^>]* open/);
    expect(summary).toContain('Sep 2019 – today');
    expect(summary).toContain('Software Engineer');
    expect(summary).not.toContain('Did things');
    expect(details).toContain('Did things');
    expect(details).toContain('Highlight one');
    expect(details).toContain('Java');
  });
});

describe('ServiceCard', () => {
  it('shows no category chip', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ServiceCard, {
      props: { service, locale: 'en' },
    });
    expect(html).not.toContain('chip');
  });

  it.each([
    ['own', 'en', 'my project'],
    ['contributor', 'en', 'contributor'],
    ['own', 'de', 'mein Projekt'],
    ['contributor', 'de', 'mitentwickelt'],
  ] as const)(
    'links a %s project with its badge in %s',
    async (role, locale, label) => {
      const container = await AstroContainer.create();
      const html = await container.renderToString(ServiceCard, {
        props: {
          service: { ...service, project: { slug: 'tutto', role } },
          locale,
        },
      });
      expect(html).toContain('href="/projects/tutto/"');
      expect(html).toContain(label);
      expect(html).not.toContain('target="_blank"');
    },
  );

  it('shows no badge without a project', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ServiceCard, {
      props: { service, locale: 'en' },
    });
    expect(html).not.toContain('/projects/');
  });

  it.each([
    ['en', 'unknown'],
    ['de', 'unbekannt'],
  ] as const)(
    'renders unverified services as unknown in %s',
    async (locale, label) => {
      const container = await AstroContainer.create();
      const html = await container.renderToString(ServiceCard, {
        props: { service: { ...service, status: 'online' }, locale },
      });
      const document = new Window().document;
      document.body.innerHTML = html;
      expect(document.querySelector('[data-status-label]')?.textContent).toBe(
        label,
      );
      expect(html).not.toContain('bg-emerald-400');
    },
  );
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

  it('localizes a service display name without changing its status identifier', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ServiceCard, {
      props: {
        service: {
          ...service,
          name: 'Bulk Storage',
          displayName: { en: 'Bulk Storage', de: 'Datenspeicher' },
        },
        locale: 'de',
      },
    });

    expect(html).toContain('data-service="Bulk Storage"');
    expect(html).toContain('>Datenspeicher</');
  });
});

describe('ProjectCard layout', () => {
  const withStory: Project = {
    ...project,
    story: {
      problem: { en: 'p' },
      contribution: { en: 'c' },
      decisions: { en: 'd' },
      outcome: { en: 'o' },
    } as Project['story'],
  };

  async function render(p: Project) {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ProjectCard, {
      props: { project: p, locale: 'en' },
    });
    const document = new Window().document;
    document.body.innerHTML = html;
    return { html, document };
  }

  it('has no hover border effect', async () => {
    const { html } = await render(project);
    expect(html).not.toContain('hover:border-accent');
    expect(html).not.toContain('transition-colors');
  });

  it('links the project name to the story only when there is one', async () => {
    const withLink = (await render(withStory)).document;
    expect(withLink.querySelector('h3 a')?.getAttribute('href')).toBe(
      '/projects/demo/',
    );
    const plain = (await render(project)).document;
    expect(plain.querySelector('h3 a')).toBeNull();
    expect(plain.querySelector('h3')?.textContent?.trim()).toBe('DemoTool');
  });

  it('spaces the action links widely with text-sm links', async () => {
    const { document } = await render({
      ...withStory,
      link: 'https://x.test/',
    });
    const actions = document.querySelector('[data-project-actions]')!;
    expect(actions.className).toContain('gap-x-6');
    expect(actions.className).toContain('gap-y-2');
    for (const a of actions.querySelectorAll('a')) {
      expect(a.className).toContain('text-sm');
    }
  });

  it('enlarges the description but not the tagline', async () => {
    const { html } = await render(project);
    expect(html).toContain('text-[15px]');
  });
});
