import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const CSS = readFileSync(join(import.meta.dirname, 'global.css'), 'utf8');

/** WCAG 2.1 minimums. Text below 24px (or 18.66px bold) is "normal". */
const AA_NORMAL_TEXT = 4.5;

type Tokens = Record<string, string>;

/** The `--name: value;` pairs declared in the first block matching `header`. */
function tokensIn(header: RegExp): Tokens {
  const start = CSS.search(header);
  if (start < 0) {
    throw new Error(`no block matching ${String(header)}`);
  }
  const end = CSS.indexOf('\n}', start);
  const body = CSS.slice(start, end);
  const tokens: Tokens = {};
  for (const [, name, value] of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    tokens[name] = value.trim();
  }
  return tokens;
}

const light = tokensIn(/^:root \{/m);
const dark = tokensIn(/^\.dark \{/m);
// Inside @media print, the .dark block is re-declared with light values so a
// dark-theme visitor still prints dark ink on white.
const print = tokensIn(/@media print \{\s*\n\s*\.dark \{/);

// --- oklch() -> sRGB, so contrast can be checked without a browser. ---

/** One sRGB channel (0-1) from a linear-light value, per the sRGB transfer curve. */
function gammaEncode(channel: number): number {
  return channel <= 0.0031308
    ? 12.92 * channel
    : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;
}

/** Inverse of gammaEncode — what WCAG calls for before weighting channels. */
function gammaDecode(channel: number): number {
  return channel <= 0.04045
    ? channel / 12.92
    : Math.pow((channel + 0.055) / 1.055, 2.4);
}

/** `oklch(52% 0.14 155)` -> the three 8-bit sRGB channels a browser paints. */
function oklchToRgb(color: string): [number, number, number] {
  const parts = /oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)/.exec(color);
  if (!parts) {
    throw new Error(`not an oklch() colour: ${color}`);
  }
  const lightness = Number(parts[1]) / 100;
  const chroma = Number(parts[2]);
  const hue = (Number(parts[3]) * Math.PI) / 180;
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);

  // OKLab -> LMS (cube roots) -> linear sRGB, Björn Ottosson's matrices.
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return linear.map((channel) =>
    Math.round(Math.min(1, Math.max(0, gammaEncode(channel))) * 255),
  ) as [number, number, number];
}

function relativeLuminance(color: string): number {
  const [r, g, b] = oklchToRgb(color).map((c) => gammaDecode(c / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two oklch() colours, 1 (same) to 21 (max). */
function contrast(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return Number(((hi + 0.05) / (lo + 0.05)).toFixed(2));
}

describe('contrast maths', () => {
  // Guards the conversion above: without these, a broken transform would
  // quietly report every pair as passing.
  it('puts black and white at the extremes', () => {
    expect(contrast('oklch(0% 0 0)', 'oklch(100% 0 0)')).toBeCloseTo(21, 0);
    expect(contrast('oklch(52% 0.14 155)', 'oklch(52% 0.14 155)')).toBe(1);
  });

  // Measured in Chrome against the built stylesheet.
  it('agrees with the browser on the palette it was checked against', () => {
    expect(contrast('oklch(52% 0.14 155)', 'oklch(93% 0.045 155)')).toBeCloseTo(
      4.21,
      1,
    );
    expect(
      contrast('oklch(25% 0.012 260)', 'oklch(98.5% 0.004 95)'),
    ).toBeCloseTo(15.3, 1);
  });
});

describe('palette contrast', () => {
  const pairs = [
    ['ink on surface', '--ink', '--surface'],
    ['muted on surface', '--muted', '--surface'],
    ['muted on panel', '--muted', '--panel'],
    ['accent on surface', '--accent', '--surface'],
    ['accent on panel', '--accent', '--panel'],
    // The active status badge and the accent button's hover state.
    ['accent on accent-soft', '--accent', '--accent-soft'],
    // Solid accent buttons put surface-coloured text on the accent.
    ['surface on accent', '--surface', '--accent'],
  ] as const;

  for (const [theme, tokens] of [
    ['light', light],
    ['dark', dark],
  ] as const) {
    for (const [label, fg, bg] of pairs) {
      it(`${theme}: ${label} is legible`, () => {
        expect(contrast(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(
          AA_NORMAL_TEXT,
        );
      });
    }
  }
});

describe('print palette', () => {
  // The print block re-declares the light values so a dark-theme visitor
  // prints dark ink on white. A comment used to be the only thing keeping
  // the two copies in step.
  it('re-declares every token the dark theme overrides', () => {
    expect(Object.keys(print).sort()).toEqual(Object.keys(dark).sort());
  });

  it('matches the light palette exactly', () => {
    for (const [name, value] of Object.entries(light)) {
      expect(print[name], name).toBe(value);
    }
  });
});
