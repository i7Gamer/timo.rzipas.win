import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';

import { EMAIL, LINKEDIN_URL } from '../data/site';
import { CV_DOWNLOADS } from '../data/cv';
import { PROJECTS } from '../data/projects';
import { Window } from 'happy-dom';
import { LOCALES } from '../i18n';
import type { Project } from '../lib/projects';
import ContactSection from './ContactSection.astro';
import ProjectCard from './ProjectCard.astro';
import ProjectStory from './ProjectStory.astro';
import TimelineItem from './TimelineItem.astro';

const project: Project = {
  slug: 'example',
  name: 'Example',
  tagline: { en: 'A useful tool', de: 'Ein nützliches Werkzeug' },
  description: { en: 'Short description', de: 'Kurze Beschreibung' },
  tech: ['TypeScript'],
  status: 'archived',
  featured: false,
  order: 1,
  story: {
    problem: { en: 'The problem', de: 'Die Ausgangslage' },
    contribution: { en: 'My contribution', de: 'Meine Arbeit' },
    decisions: { en: 'The decision', de: 'Die Entscheidung' },
    outcome: { en: 'The result', de: 'Das Ergebnis' },
  },
};

describe('portfolio components', () => {
  it('uses a localized project display name in the German story', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ProjectStory, {
      props: {
        project: {
          ...project,
          name: 'Bachelor thesis',
          displayName: { en: 'Bachelor thesis', de: 'Bachelorarbeit' },
        },
        locale: 'de',
      },
    });

    expect(html).toContain('>Bachelorarbeit</h1>');
    expect(html).not.toContain('>Bachelor thesis</h1>');
  });

  it.each(LOCALES)(
    'renders readable, localized project screenshots in %s',
    async (locale) => {
      const container = await AstroContainer.create();
      const illustrated = PROJECTS.find((entry) => entry.slug === 'myspeed')!;
      const html = await container.renderToString(ProjectStory, {
        props: { project: illustrated, locale },
      });
      const document = new Window().document;
      document.body.innerHTML = html;
      const figures = document.querySelectorAll('figure');
      expect(figures).toHaveLength(illustrated.story!.images!.length);
      figures.forEach((figure, index) => {
        const source = illustrated.story!.images![index];
        const img = figure.querySelector('img')!;
        expect(img.getAttribute('alt')).toBe(source.alt[locale]);
        expect(img.getAttribute('loading')).toBe('lazy');
        expect(Number(img.getAttribute('width'))).toBeGreaterThan(0);
        expect(Number(img.getAttribute('height'))).toBeGreaterThan(0);
        expect(img.closest('a')).toBeNull();
        expect(figure.textContent).toContain(source.caption[locale]);
      });
      expect(document.querySelectorAll('h1')).toHaveLength(1);
    },
  );

  it.each(LOCALES)(
    'links a story and uses the requested card heading in %s',
    async (locale) => {
      const container = await AstroContainer.create();
      const html = await container.renderToString(ProjectCard, {
        props: { project, locale, headingLevel: 'h2' },
      });
      expect(html).toMatch(/<h2\b/);
      expect(html).toContain('href="/projects/example/"');
      expect(html).not.toContain('target="_blank"');
    },
  );

  it('renders a link-free project without an empty actions row', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ProjectCard, {
      props: { project: { ...project, story: undefined }, locale: 'en' },
    });
    expect(html).toMatch(/<h3\b/);
    expect(html).not.toContain('<a ');
    expect(html).not.toContain('data-project-actions');
  });

  it.each(LOCALES)(
    'renders complete story content and no empty media/links in %s',
    async (locale) => {
      const container = await AstroContainer.create();
      const html = await container.renderToString(ProjectStory, {
        props: { project, locale },
      });
      expect(html).toMatch(/<h1\b/);
      for (const section of [
        'problem',
        'contribution',
        'decisions',
        'outcome',
      ] as const)
        expect(html).toContain(project.story![section][locale]);
      expect(html).toContain('href="/projects/"');
      expect(html).not.toContain('<figure');
      expect(html).not.toContain('data-project-external');
    },
  );

  it('renders provenance, the diagram, and external links', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ProjectStory, {
      props: {
        locale: 'en',
        project: {
          ...project,
          repo: 'https://github.com/example/tool',
          link: 'https://example.com',
          story: {
            ...project.story!,
            provenance: {
              en: 'Based on an earlier project',
              de: 'Basiert auf einem früheren Projekt',
            },
            upstream: 'https://github.com/example/original',
            diagram: {
              title: { en: 'A turn', de: 'Ein Zug' },
              steps: [
                { en: 'Draw', de: 'Ziehen' },
                { en: 'Roll', de: 'Würfeln' },
              ],
            },
          },
        },
      },
    });
    expect(html).toContain('Based on an earlier project');
    expect(html).toContain('https://github.com/example/original');
    expect(html).toContain('Draw');
    expect(html).toContain('Roll');
    expect(html).toContain('data-project-external');
  });

  it.each([undefined, []])(
    'omits absent/empty timeline highlights',
    async (highlights) => {
      const container = await AstroContainer.create();
      const html = await container.renderToString(TimelineItem, {
        props: { period: '2018', title: 'Degree', highlights },
      });
      expect(html).not.toContain('<ul');
    },
  );

  it('renders an anchored job with useful highlights', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(TimelineItem, {
      props: {
        id: 'abacus',
        period: '2019 – present',
        title: 'Software Engineer',
        highlights: ['Automatic document processing', 'Maintenance'],
      },
    });
    expect(html).toContain('id="abacus"');
    expect(html).toContain('Automatic document processing');
    expect(html).toContain('Maintenance');
  });

  it.each(LOCALES)(
    'shows direct contact and puts the matching CV first in %s',
    async (locale) => {
      const container = await AstroContainer.create();
      const html = await container.renderToString(ContactSection, {
        props: { locale },
      });
      const other = locale === 'en' ? 'de' : 'en';
      expect(html).toContain('id="contact"');
      expect(html).toContain(`mailto:${EMAIL}`);
      expect(html).toContain(LINKEDIN_URL);
      expect(html.indexOf(CV_DOWNLOADS[locale])).toBeLessThan(
        html.indexOf(CV_DOWNLOADS[other]),
      );
      for (const href of Object.values(CV_DOWNLOADS))
        expect(html).toContain(`href="${href}"`);
    },
  );
});
