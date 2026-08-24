import { describe, expect, it } from 'vitest';

import { DEFAULT_THEME, nextTheme, resolveTheme } from './theme';

describe('resolveTheme', () => {
  it('accepts both valid themes', () => {
    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
  });

  it('falls back to the default (dark) for anything else', () => {
    expect(DEFAULT_THEME).toBe('dark');
    expect(resolveTheme(null)).toBe(DEFAULT_THEME);
    expect(resolveTheme(undefined)).toBe(DEFAULT_THEME);
    expect(resolveTheme('solarized')).toBe(DEFAULT_THEME);
    expect(resolveTheme('')).toBe(DEFAULT_THEME);
  });
});

describe('nextTheme', () => {
  it('toggles between dark and light', () => {
    expect(nextTheme('dark')).toBe('light');
    expect(nextTheme('light')).toBe('dark');
  });
});
