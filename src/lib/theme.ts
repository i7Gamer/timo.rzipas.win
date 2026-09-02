export type Theme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'theme';
export const DARK_THEME: Theme = 'dark';
export const LIGHT_THEME: Theme = 'light';
export const DEFAULT_THEME: Theme = DARK_THEME;

/**
 * Class on <html> while DARK_THEME is active; its absence means LIGHT_THEME.
 * Spelled again in src/styles/global.css (the dark variant and the .dark
 * palette block), where it cannot be imported — src/lib/theme.test.ts keeps
 * those spellings in step with this constant.
 */
export const DARK_CLASS = 'dark';

/**
 * The --surface background per theme as hex, for <meta name="theme-color">
 * (browser UI chrome). Keep in sync with :root/.dark in src/styles/global.css.
 */
export const THEME_COLORS: Record<Theme, string> = {
  dark: '#0d1014',
  light: '#fbfaf7',
};

/** Whether a value read from storage names a theme this site has. */
export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && Object.hasOwn(THEME_COLORS, value);
}

export function nextTheme(theme: Theme): Theme {
  return theme === DARK_THEME ? LIGHT_THEME : DARK_THEME;
}

/** The part of Element the theme helpers touch, so tests can pass a fake. */
export interface ThemedRoot {
  classList: Pick<DOMTokenList, 'contains' | 'toggle'>;
}

/** The theme the root currently shows. */
export function currentTheme(root: ThemedRoot): Theme {
  return root.classList.contains(DARK_CLASS) ? DARK_THEME : LIGHT_THEME;
}

/** Shows `theme` on the root. */
export function applyTheme(root: ThemedRoot, theme: Theme): void {
  root.classList.toggle(DARK_CLASS, theme === DARK_THEME);
}
