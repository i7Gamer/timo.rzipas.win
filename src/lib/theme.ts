export type Theme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'theme';
export const DEFAULT_THEME: Theme = 'dark';
export const DARK_CLASS = 'dark';

export function resolveTheme(stored: unknown): Theme {
  return stored === 'light' || stored === 'dark' ? stored : DEFAULT_THEME;
}

export function nextTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark';
}
