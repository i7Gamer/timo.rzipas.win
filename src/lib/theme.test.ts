import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  applyTheme,
  currentTheme,
  DARK_CLASS,
  DARK_THEME,
  DEFAULT_THEME,
  isTheme,
  LIGHT_THEME,
  nextTheme,
  THEME_COLORS,
  themeBootstrapScript,
  type ThemedRoot,
} from './theme';

const SRC_DIR = join(import.meta.dirname, '..');

function read(file: string): string {
  return readFileSync(join(SRC_DIR, file), 'utf8');
}

/** Just enough of an Element for the theme helpers, backed by a Set. */
function fakeRoot(...classes: string[]): ThemedRoot & { classes: Set<string> } {
  const set = new Set(classes);
  return {
    classes: set,
    classList: {
      contains: (token) => set.has(token),
      toggle: (token, force) => {
        const on = force ?? !set.has(token);
        if (on) {
          set.add(token);
        } else {
          set.delete(token);
        }
        return on;
      },
    },
  };
}

describe('nextTheme', () => {
  it('toggles between dark and light', () => {
    expect(nextTheme(DARK_THEME)).toBe(LIGHT_THEME);
    expect(nextTheme(LIGHT_THEME)).toBe(DARK_THEME);
  });
});

describe('isTheme', () => {
  it('accepts every theme that has a colour', () => {
    for (const theme of Object.keys(THEME_COLORS)) {
      expect(isTheme(theme)).toBe(true);
    }
  });

  it.each(['blue', '', 'Dark', 'constructor', null, undefined, 42])(
    'rejects %j',
    (value) => {
      expect(isTheme(value)).toBe(false);
    },
  );
});

describe('currentTheme', () => {
  it('is dark while the dark class is on the root', () => {
    expect(currentTheme(fakeRoot('other', DARK_CLASS))).toBe(DARK_THEME);
  });

  it('is light otherwise', () => {
    expect(currentTheme(fakeRoot())).toBe(LIGHT_THEME);
    expect(currentTheme(fakeRoot('other'))).toBe(LIGHT_THEME);
  });
});

describe('applyTheme', () => {
  it('puts the dark class on for the dark theme and takes it off for light', () => {
    const root = fakeRoot('other');
    applyTheme(root, DARK_THEME);
    expect(root.classes.has(DARK_CLASS)).toBe(true);
    applyTheme(root, LIGHT_THEME);
    expect(root.classes.has(DARK_CLASS)).toBe(false);
    expect(root.classes.has('other')).toBe(true);
  });

  it('round-trips with currentTheme', () => {
    const root = fakeRoot();
    for (const theme of [DARK_THEME, LIGHT_THEME, DARK_THEME]) {
      applyTheme(root, theme);
      expect(currentTheme(root)).toBe(theme);
    }
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

// The class name is spelled in CSS and in the layout too, where it cannot be
// imported. These keep every spelling tied to the one constant.
describe('dark class', () => {
  it('is what the stylesheet switches its palette on', () => {
    const css = read('styles/global.css');
    expect(css).toContain(
      `@custom-variant dark (&:where(.${DARK_CLASS}, .${DARK_CLASS} *));`,
    );
    expect(css.split('\n')).toContain(`.${DARK_CLASS} {`);
  });

  it('reaches the layout through the constants, not a literal', () => {
    const layout = read('layouts/BaseLayout.astro');
    expect(layout).toContain('DARK_CLASS');
    expect(layout).not.toMatch(/class="dark"/);
    // The inline bootstrap gets its names via define:vars.
    expect(layout).not.toMatch(/=== '(?:dark|light)'/);
    expect(layout).not.toMatch(/toggle\('dark'/);
  });
});

describe('themeBootstrapScript', () => {
  /** Runs the inline script against fakes, the way a browser would before first paint. */
  function boot(stored: string | null | (() => never)) {
    const root = fakeRoot('other');
    const meta = {
      content: 'unset',
      setAttribute(name: string, value: string) {
        if (name === 'content') {
          this.content = value;
        }
      },
    };
    const document = {
      documentElement: root,
      querySelector: (selector: string) =>
        selector === 'meta[name="theme-color"]' ? meta : null,
    };
    const localStorage = {
      getItem: () => (typeof stored === 'function' ? stored() : stored),
    };
    new Function('document', 'localStorage', themeBootstrapScript())(
      document,
      localStorage,
    );
    return { root, meta };
  }

  it('is the same text on every call, so its CSP hash is stable', () => {
    expect(themeBootstrapScript()).toBe(themeBootstrapScript());
  });

  it('applies the default theme when nothing is stored', () => {
    const { root, meta } = boot(null);
    expect(currentTheme(root)).toBe(DEFAULT_THEME);
    expect(meta.content).toBe(THEME_COLORS[DEFAULT_THEME]);
  });

  it('applies a stored theme and its colour', () => {
    const { root, meta } = boot(LIGHT_THEME);
    expect(currentTheme(root)).toBe(LIGHT_THEME);
    expect(meta.content).toBe(THEME_COLORS[LIGHT_THEME]);
  });

  it.each(['bogus', '', 'constructor'])('ignores stored value %j', (value) => {
    const { root } = boot(value);
    expect(currentTheme(root)).toBe(DEFAULT_THEME);
  });

  it('keeps the default when storage throws', () => {
    const { root } = boot(() => {
      throw new Error('storage disabled');
    });
    expect(currentTheme(root)).toBe(DEFAULT_THEME);
    expect(root.classes.has('other')).toBe(true);
  });
});
