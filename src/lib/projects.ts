import type { Locale, Localized } from '../i18n';
import type { ImageMetadata } from 'astro';

export interface ProjectStoryContent {
  problem: Record<Locale, string>;
  contribution: Record<Locale, string>;
  decisions: Record<Locale, string>;
  outcome: Record<Locale, string>;
  provenance?: Record<Locale, string>;
  upstream?: string;
  images?: Array<{
    image: ImageMetadata;
    alt: Record<Locale, string>;
    caption: Record<Locale, string>;
  }>;
  diagram?: { title: Record<Locale, string>; steps: Record<Locale, string>[] };
}

export type ProjectStatus = 'active' | 'archived';

export interface Project {
  slug: string;
  name: string;
  tagline: Localized<string>;
  description: Localized<string>;
  tech: string[];
  repo?: string;
  link?: string;
  status: ProjectStatus;
  /** Set when the project is a fork I contribute to rather than my own. */
  fork?: boolean;
  featured: boolean;
  order: number;
  story?: ProjectStoryContent;
}

export function projectHref(slug: string): string {
  return `/projects/${slug}/`;
}

export function storyProjects(
  projects: readonly Project[],
): Array<Project & { story: ProjectStoryContent }> {
  return sortProjects(projects).filter(
    (project): project is Project & { story: ProjectStoryContent } =>
      project.story !== undefined,
  );
}

export function sortProjects(projects: readonly Project[]): Project[] {
  return [...projects].sort((a, b) => a.order - b.order);
}

export function featuredProjects(projects: readonly Project[]): Project[] {
  return sortProjects(projects.filter((project) => project.featured));
}
