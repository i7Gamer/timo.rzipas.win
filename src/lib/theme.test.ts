import { describe, expect, it } from 'vitest';

import { DEFAULT_THEME, nextTheme, THEME_COLORS } from './theme';

describe('nextTheme', () => {
  it('toggles between dark and light', () => {
    expect(nextTheme('dark')).toBe('light');
    expect(nextTheme('light')).toBe('dark');
  });
});

describe('THEME_COLORS', () => {
  it('provides a hex surface color for every theme', () => {
    expect(THEME_COLORS.dark).toMatch(/^#[0-9a-f]{6}$/);
    expect(THEME_COLORS.light).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('covers the default theme', () => {
    expect(THEME_COLORS[DEFAULT_THEME]).toBeTruthy();
  });
});
