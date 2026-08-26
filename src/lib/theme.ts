export type Theme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'theme';
export const DEFAULT_THEME: Theme = 'dark';
export const DARK_CLASS = 'dark';

/**
 * The --surface background per theme as hex, for <meta name="theme-color">
 * (browser UI chrome). Keep in sync with :root/.dark in src/styles/global.css.
 */
export const THEME_COLORS: Record<Theme, string> = {
  dark: '#0d1014',
  light: '#fbfaf7',
};

export function nextTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark';
}
