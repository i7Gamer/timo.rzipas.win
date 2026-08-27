import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { LOCALES, t } from '../i18n';
import { OG_IMAGE } from './site';

/** Width and height straight out of a PNG's IHDR chunk. */
function pngSize(file: string): { width: number; height: number } {
  const bytes = readFileSync(file);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe('OG_IMAGE', () => {
  it('points at a file that ships with the site', () => {
    expect(OG_IMAGE.path.startsWith('/')).toBe(true);
    expect(() =>
      readFileSync(join(import.meta.dirname, '../../public', OG_IMAGE.path)),
    ).not.toThrow();
  });

  // The declared size is what social cards reserve space for, so a replacement
  // image of a different size would silently letterbox every preview.
  it('declares the real dimensions of that file', () => {
    const actual = pngSize(
      join(import.meta.dirname, '../../public', OG_IMAGE.path),
    );
    expect(actual.width).toBe(OG_IMAGE.width);
    expect(actual.height).toBe(OG_IMAGE.height);
  });

  it('has alt text in every locale', () => {
    for (const locale of LOCALES) {
      expect(t(locale, 'og.imageAlt'), locale).not.toBe('og.imageAlt');
    }
  });
});
