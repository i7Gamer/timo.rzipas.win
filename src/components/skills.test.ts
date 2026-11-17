import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';

import { SKILL_GROUPS } from '../data/skills';
import SkillGroups from './SkillGroups.astro';

async function render(locale: 'en' | 'de') {
  const container = await AstroContainer.create();
  const html = await container.renderToString(SkillGroups, {
    props: { locale },
  });
  const window = new Window();
  window.document.body.innerHTML = html;
  return window.document;
}

describe('SkillGroups', () => {
  it.each(['en', 'de'] as const)(
    'renders every group title and skill name as text in %s',
    async (locale) => {
      const doc = await render(locale);
      const titles = [...doc.querySelectorAll('h3')].map((h) => h.textContent);
      expect(titles).toEqual(SKILL_GROUPS.map((group) => group.title[locale]));
      const tiles = [...doc.querySelectorAll('li')].map((li) =>
        li.textContent?.trim(),
      );
      for (const group of SKILL_GROUPS)
        for (const item of group.items) expect(tiles).toContain(item.name);
    },
  );

  it('gives each tile a decorative currentColor svg icon', async () => {
    const doc = await render('en');
    const icons = [...doc.querySelectorAll('span[aria-hidden="true"]')];
    const skillCount = SKILL_GROUPS.flatMap((group) => group.items).length;
    expect(icons).toHaveLength(skillCount);
    for (const icon of icons) {
      expect(icon.className).toContain('text-accent');
      expect(icon.querySelector('svg')?.outerHTML).toContain('currentColor');
    }
  });

  it.each([
    ['en', 'Where I used it'],
    ['de', 'Wo ich es eingesetzt habe'],
  ] as const)('labels evidence links in %s', async (locale, label) => {
    const doc = await render(locale);
    expect(doc.body.textContent).toContain(label);
    const hrefs = [...doc.querySelectorAll('a')].map((a) =>
      a.getAttribute('href'),
    );
    const expected = SKILL_GROUPS.flatMap((group) =>
      (group.evidence ?? []).map((e) => e.href),
    );
    expect(hrefs).toEqual(expected);
  });
});
