import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';
import { SERVICE_GROUPS, SERVICES } from '../data/services';
import { LOCALES, pick, t } from '../i18n';
import { applyStatuses } from '../lib/live-status';
import ServiceGroups from './ServiceGroups.astro';

describe('grouped homelab services', () => {
  it.each(LOCALES)(
    'renders every service once under its localized group in %s',
    async (locale) => {
      const container = await AstroContainer.create();
      const html = await container.renderToString(ServiceGroups, {
        props: { locale },
      });
      const document = new Window().document;
      document.body.innerHTML = html;
      const roots = document.querySelectorAll('[data-status-grid]');
      expect(roots).toHaveLength(1);
      const root = roots[0];
      const names = [...root.querySelectorAll('[data-service]')].map((card) =>
        card.getAttribute('data-service'),
      );
      expect(names.sort()).toEqual(
        SERVICES.map((service) => service.name).sort(),
      );
      expect(new Set(SERVICE_GROUPS.map((group) => group.id)).size).toBe(
        SERVICE_GROUPS.length,
      );
      for (const group of SERVICE_GROUPS) {
        const section = root.querySelector(
          `[data-service-group="${group.id}"]`,
        )!;
        expect(section.querySelector('h3')?.textContent).toBe(
          pick(locale, group.title),
        );
        const members = SERVICES.filter(
          (service) => service.group === group.id,
        );
        expect(members.length).toBeGreaterThan(0);
        expect(
          [...section.querySelectorAll('h4')].map(
            (heading) => heading.textContent,
          ),
        ).toEqual(
          members.map((service) =>
            service.displayName
              ? pick(locale, service.displayName)
              : service.name,
          ),
        );
      }
      const statuses = Object.fromEntries(
        SERVICES.map((service) => [service.name, 'offline']),
      );
      expect(
        applyStatuses(
          root as unknown as ParentNode,
          { services: statuses },
          { offline: t(locale, 'status.offline') },
        ),
      ).toBe(SERVICES.length);
      for (const label of root.querySelectorAll('[data-status-label]')) {
        expect(label.textContent).toBe(t(locale, 'status.offline'));
      }
    },
  );
});

describe('collapsible service groups', () => {
  async function render(locale: (typeof LOCALES)[number]) {
    const container = await AstroContainer.create();
    const html = await container.renderToString(ServiceGroups, {
      props: { locale },
    });
    const document = new Window().document;
    document.body.innerHTML = html;
    return document;
  }

  it.each(LOCALES)(
    'renders each group as details, only the first open, in %s',
    async (locale) => {
      const document = await render(locale);
      const groups = [...document.querySelectorAll('[data-service-group]')];
      expect(groups.map((group) => group.tagName)).toEqual(
        SERVICE_GROUPS.map(() => 'DETAILS'),
      );
      expect(groups.filter((group) => group.hasAttribute('open')).length).toBe(
        1,
      );
      expect(groups[0].hasAttribute('open')).toBe(true);
      for (const group of groups) {
        expect(group.hasAttribute('data-print-open')).toBe(true);
        expect(group.querySelector('summary h3')).not.toBeNull();
      }
    },
  );

  it.each(LOCALES)(
    'shows a static count per group and in the summary in %s',
    async (locale) => {
      const document = await render(locale);
      const summary = document.querySelector('[data-status-summary]')!;
      const total = SERVICES.filter((s) => s.status !== 'planned').length;
      expect(summary.textContent?.trim()).toBe(
        t(locale, 'services.count').replace('{total}', String(total)),
      );
      expect(summary.getAttribute('data-template')).toBe(
        t(locale, 'services.summaryLive'),
      );
      for (const group of SERVICE_GROUPS) {
        const count = document.querySelector(
          `[data-service-group="${group.id}"] summary [data-group-count]`,
        )!;
        const members = SERVICES.filter(
          (s) => s.group === group.id && s.status !== 'planned',
        ).length;
        expect(count.textContent?.trim()).toBe(
          t(locale, 'services.count').replace('{total}', String(members)),
        );
        expect(count.getAttribute('data-template')).toBe(
          t(locale, 'services.groupOnline'),
        );
      }
    },
  );
});
