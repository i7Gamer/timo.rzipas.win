import { pick, t, type Locale, type Localized } from '../i18n';
import type { ImageMetadata } from 'astro';

export interface ProjectStoryContent {
  problem: Record<Locale, string>;
  contribution: Record<Locale, string>;
  decisions: Record<Locale, string>;
  outcome: Record<Locale, string>;
  additionalSections?: readonly {
    id: string;
    title: Localized<string>;
    text: Localized<string>;
    links?: readonly { href: string; label: Localized<string> }[];
  }[];
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
  displayName?: Localized<string>;
  tagline: Localized<string>;
  description: Localized<string>;
  contributionSummary?: Record<Locale, string>;
  tech: string[];
  repo?: string;
  sources?: Array<{ href: string; label: Localized<string> }>;
  link?: string;
  status: ProjectStatus;
  /** Set when the project is a fork I contribute to rather than my own. */
  fork?: boolean;
  featured: boolean;
  /** Homepage order when it differs from the Projects page. */
  featuredOrder?: number;
  order: number;
  story?: ProjectStoryContent;
  /** Square app icon, shown on cards and the story header. */
  logo?: ImageMetadata;
}

export function projectName(project: Project, locale: Locale): string {
  return project.displayName ? pick(locale, project.displayName) : project.name;
}

export function projectSources(
  project: Project,
  locale: Locale,
): Array<{ href: string; label: string }> {
  if (project.sources) {
    return project.sources.map((source) => ({
      href: source.href,
      label: pick(locale, source.label),
    }));
  }
  return project.repo
    ? [{ href: project.repo, label: t(locale, 'project.source') }]
    : [];
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
  return projects
    .filter((project) => project.featured)
    .sort(
      (a, b) => (a.featuredOrder ?? a.order) - (b.featuredOrder ?? b.order),
    );
}
