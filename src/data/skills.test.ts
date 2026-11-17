import { describe, expect, it } from 'vitest';

import { LOCALES } from '../i18n';
import { renderIconSvg } from '../lib/icons';
import { SKILL_GROUPS } from './skills';

const ICON_SIZE = 24;

describe('SKILL_GROUPS icons', () => {
  const items = SKILL_GROUPS.flatMap((group) => group.items);

  it('has the four expected groups in order', () => {
    expect(SKILL_GROUPS.map((group) => group.title.en)).toEqual([
      'Languages',
      'Frameworks',
      'Data',
      'Ops & tooling',
    ]);
    for (const group of SKILL_GROUPS)
      for (const locale of LOCALES)
        expect(group.title[locale]?.trim()).toBeTruthy();
  });

  it('resolves every icon id to icon data', () => {
    for (const item of items)
      expect(
        () => renderIconSvg(item.icon, ICON_SIZE),
        item.name,
      ).not.toThrow();
  });

  it('has unique skill names across all groups', () => {
    const names = items.map((item) => item.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
