import type { Localized } from '../i18n';

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
}

export function sortProjects(projects: readonly Project[]): Project[] {
  return [...projects].sort((a, b) => a.order - b.order);
}

export function featuredProjects(projects: readonly Project[]): Project[] {
  return sortProjects(projects.filter((project) => project.featured));
}
